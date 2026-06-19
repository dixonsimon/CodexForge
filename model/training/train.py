import os
import argparse
import random
import torch
from transformers import (
    Trainer,
    TrainingArguments,
    DataCollatorForLanguageModeling,
    AutoTokenizer,
)
from datasets import load_dataset
from model import CodexForgeConfig, CodexForgeForCausalLM

# FIM special tokens
PRE_TOKEN = "<fim_prefix>"
SUF_TOKEN = "<fim_suffix>"
MID_TOKEN = "<fim_middle>"
EOT_TOKEN = "<fim_eot>"

def apply_fim(tokens, tokenizer, fim_rate=0.5, suffix_tok_id=None, prefix_tok_id=None, middle_tok_id=None):
    """
    Applies Fill-in-the-Middle (FIM) transformations on a sequence of tokens with 50% probability.
    This shifts prefix/suffix positions to enable mid-document completion capability.
    """
    if random.random() > fim_rate:
        return tokens

    length = len(tokens)
    if length < 8:
        return tokens

    # Split the sequence randomly into three parts
    bound1 = random.randint(1, length - 2)
    bound2 = random.randint(bound1 + 1, length - 1)

    prefix = tokens[:bound1]
    middle = tokens[bound1:bound2]
    suffix = tokens[bound2:]

    # Construct the FIM sequence
    new_tokens = [prefix_tok_id] + prefix + [suffix_tok_id] + suffix + [middle_tok_id] + middle
    return new_tokens

def preprocess_function(examples, tokenizer, max_length=2048):
    # Fetch special token IDs
    prefix_id = tokenizer.convert_tokens_to_ids(PRE_TOKEN)
    suffix_id = tokenizer.convert_tokens_to_ids(SUF_TOKEN)
    middle_id = tokenizer.convert_tokens_to_ids(MID_TOKEN)

    tokenized = tokenizer(examples["text"], truncation=False, add_special_tokens=False)
    input_ids = []
    
    for tokens in tokenized["input_ids"]:
        # Apply FIM
        processed = apply_fim(
            tokens, 
            tokenizer, 
            fim_rate=0.5, 
            suffix_tok_id=suffix_id, 
            prefix_tok_id=prefix_id, 
            middle_tok_id=middle_id
        )
        # Handle maximum sequence constraints
        processed = processed[:max_length]
        input_ids.append(processed)

    return {"input_ids": input_ids}

def train():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_dir", type=str, default="./checkpoints")
    parser.add_argument("--dataset_name", type=str, default="codeparrot/github-code-clean")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch_size", type=int, default=4)
    parser.add_argument("--lr", type=float, default=2e-5)
    parser.add_argument("--deepspeed", type=str, default=None)
    parser.add_argument("--max_length", type=int, default=2048)
    args = parser.parse_args()

    # Load custom configuration
    config = CodexForgeConfig(
        vocab_size=32000,
        hidden_size=2048, # Scale down for training sample feasibility
        intermediate_size=5632,
        num_hidden_layers=12,
        num_attention_heads=16,
        num_key_value_heads=4,
        max_position_embeddings=args.max_length,
    )

    model = CodexForgeForCausalLM(config)

    # Initialize tokenizer (mocking configuration with custom FIM tokens)
    tokenizer = AutoTokenizer.from_pretrained("gpt2")
    tokenizer.add_special_tokens({
        "additional_special_tokens": [PRE_TOKEN, SUF_TOKEN, MID_TOKEN, EOT_TOKEN]
    })
    # Resize vocabulary layer to match tokenizer
    model.resize_token_embeddings(len(tokenizer))

    print("Loading dataset...")
    # Load dataset sample (limit split size for demonstration runs)
    dataset = load_dataset(args.dataset_name, split="train", streaming=True)
    # Take first 1000 items for SFT dry-run representation
    dataset = dataset.take(1000)

    # Convert stream object to standard in-memory lists for tokenizing
    dataset_list = []
    for item in dataset:
        dataset_list.append({"text": item["code"]})
    
    from datasets import Dataset
    train_dataset = Dataset.from_list(dataset_list)

    print("Preprocessing data with FIM logic...")
    train_dataset = train_dataset.map(
        lambda x: preprocess_function(x, tokenizer, max_length=args.max_length),
        batched=True,
        remove_columns=["text"]
    )

    # Data Collator will dynamically pad inputs
    data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

    training_args = TrainingArguments(
        output_dir=args.model_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        learning_rate=args.lr,
        weight_decay=0.01,
        logging_steps=10,
        save_steps=100,
        fp16=True,
        deepspeed=args.deepspeed,
        report_to="none", # Disable cloud tracking integrations during testing
    )
    training_args.overwrite_output_dir = True

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        data_collator=data_collator,
    )

    print("Starting Model Training Pipeline...")
    trainer.train()

    print("Saving trained model...")
    model.save_pretrained(args.model_dir)
    tokenizer.save_pretrained(args.model_dir)
    print("Training Complete!")

if __name__ == "__main__":
    train()
