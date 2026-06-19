# LLM Training, Resources, and Deployment Guide

This guide explains how Large Language Models (LLMs) are trained, what resources are required to run them, and how to successfully host your CodexForge conversational AI platform on Vercel.

---

## 1. How LLMs are Trained (The Core Concepts)

When you interact with a system like ChatGPT or Gemini, it is powered by a foundation model that went through several phases of training:

### Phase 1: Pre-training (Creating the Base Model)
- **What happens**: The model is trained to predict the next word/token in a sequence using thousands of gigabytes of text data from the web, books, scientific papers, and code.
- **Compute Required**: Hundreds or thousands of high-performance GPUs (like NVIDIA H100s or A100s) running in parallel for weeks or months.
- **Cost**: Millions of dollars.
- **Outcome**: A "Base" model (e.g. Llama-3-Base) that understands human grammar, facts, and code syntax, but does not know how to hold a conversation or follow instructions (it only tries to complete text).

### Phase 2: Supervised Fine-Tuning / Instruction Tuning (Alignment)
- **What happens**: The base model is trained on a curated dataset of high-quality conversational prompts and corresponding good answers (e.g., Q&A, coding tasks, explanations).
- **Compute Required**: Fewer GPUs (typically 8 to 64 GPUs) for a few days.
- **Cost**: $1,000 to $50,000.
- **Outcome**: An "Instruct" or "Chat" model (e.g. Llama-3-Instruct) that behaves like an assistant and follows instructions.

### Phase 3: Alignment (RLHF & DPO)
- **What happens**: Human feedback is used to align the model's outputs with human preferences (making it helpful, harmless, and honest).
- **Outcome**: A fully conversational model like GPT-4o or Gemini 1.5.

---

## 2. Resources Needed for Self-Hosting vs. Serverless APIs

If you want to make an AI web app that is public, accessible, and fast, you have two architectural choices:

### Option A: Hosting Your Own LLM Server (Expensive)
- **Requirements**: You must deploy an open-source model (like Llama-3-8B-Instruct) on a cloud GPU container instance (AWS ECS, RunPod, Lambda Labs, or Hugging Face Inference Endpoints).
- **Cost**: A dedicated GPU node with at least 16GB-24GB VRAM (like an A10G or L4) costs roughly **$150 to $300/month** minimum just to keep it running 24/7, regardless of traffic.
- **Vercel Suitability**: **Not compatible directly**. Vercel is a serverless platform designed for lightweight web assets and API routes that run for under 15-30 seconds. You cannot run or load raw neural network model weights inside Vercel.

### Option B: Using Serverless APIs (Highly Recommended & Cost-Effective)
- **Requirements**: You connect your backend API routes to public model providers like Google Gemini API, OpenAI API, Anthropic API, or Groq API.
- **Cost**: **Pay-per-use (fraction of a penny per query)**. Gemini 2.5 Flash costs as little as $0.075 per million tokens! Groq and Hugging Face even offer extremely generous free tiers.
- **Vercel Suitability**: **Perfect**. Vercel executes serverless functions that call these APIs, streams the token chunks back to the user instantly, and scales to thousands of concurrent users with zero maintenance.

---

## 3. How to Obtain API Keys & Set Up Environment Variables

To make your web AI functional for public users on Vercel, you need to sign up for developer API keys and configure them.

### Step 1: Obtain the API Keys
1. **Google Gemini API**:
   - Go to [Google AI Studio](https://aistudio.google.com/).
   - Click "Get API Key". Create a key (Gemini offers a generous free tier for developers).
2. **OpenAI API**:
   - Go to [OpenAI Platform](https://platform.openai.com/).
   - Add a small amount of billing credit and generate an API key.
3. **Hugging Face API**:
   - Go to [Hugging Face](https://huggingface.co/).
   - Navigate to Settings -> Access Tokens -> Generate Read Token.
4. **Anthropic API (Optional)**:
   - Go to [Anthropic Console](https://console.anthropic.com/).

### Step 2: Add Keys to Vercel
When deploying your project on [Vercel](https://vercel.com/):
1. Import your GitHub repository to Vercel.
2. In the "Configure Project" screen, expand the **Environment Variables** section.
3. Add the keys exactly as named:
   - `GEMINI_API_KEY`
   - `OPENAI_API_KEY`
   - `HF_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `DATABASE_URL` (your Supabase connection URL)
   - `DIRECT_URL` (your Supabase direct connection URL)
4. Click **Deploy**. Vercel will build your frontend and expose the API keys securely to the serverless routes.

---

## 4. Features Enabled in CodexForge

By migrating to serverless APIs, CodexForge now provides:
- **General Conversation**: Full support for brainstorming, writing, trivia, and custom prompts.
- **Instant Streaming**: Fast token-by-token streaming response.
- **State Management**: SQL persistence of chat history.
- **Sandbox execution**: Isolated, serverless-safe python/js execution runtime.
