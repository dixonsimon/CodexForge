#include <linux/bpf.h>
#include <linux/pkt_cls.h>
#include <linux/ip.h>
#include <linux/in.h>
#include <linux/if_ether.h>
#include <bpf/bpf_helpers.h>

#ifndef SEC
# define SEC(NAME) __attribute__((section(NAME), used))
#endif

/*
 * eBPF Traffic Control (TC) filter program.
 * Restricts sandbox egress traffic to approved dependency registries and API domains.
 * Matches IPv4 packets and compares the destination against a map of allowed CIDR prefixes.
 */

struct {
    __uint(type, BPF_MAP_TYPE_LPM_TRIE);
    __uint(key_size, 8); // 4 bytes prefixlen + 4 bytes IPv4 address
    __uint(value_size, 1); // Boolean flag (1 = Allowed)
    __uint(max_entries, 1024);
    __uint(map_flags, BPF_F_NO_PREALLOC);
} allowed_egress_ips SEC(".maps");

struct ipv4_lpm_key {
    __u32 prefixlen;
    __u32 ipv4_addr;
};

SEC("egress_filter")
int tc_egress_filter(struct __sk_buff *skb) {
    void *data = (void *)(long)skb->data;
    void *data_end = (void *)(long)skb->data_end;

    struct ethhdr *eth = data;
    if ((void *)(eth + 1) > data_end)
        return TC_ACT_OK; // Let invalid/truncated ethernet frames pass through for standard stack drops

    // Ensure it is IPv4 traffic
    if (eth->h_proto != __constant_htons(ETH_P_IP))
        return TC_ACT_OK;

    struct iphdr *ip = (void *)(eth + 1);
    if ((void *)(ip + 1) > data_end)
        return TC_ACT_OK;

    // Build the lookup key for the LPM trie matching destination IP
    struct ipv4_lpm_key key;
    key.prefixlen = 32; // Full host match
    key.ipv4_addr = ip->daddr;

    __u8 *allowed = bpf_map_lookup_elem(&allowed_egress_ips, &key);
    if (allowed && *allowed == 1) {
        // Egress packet matches allowed registries (e.g. npmjs, github, pypi)
        return TC_ACT_OK;
    }

    // Block DNS/egress traffic outside defined parameters
    // Allow loopback and local network scopes explicitly if necessary
    __u32 dst_ip = __constant_ntohl(ip->daddr);
    if ((dst_ip & 0xFF000000) == 0x7F000000) { // 127.0.0.0/8
        return TC_ACT_OK;
    }
    
    // Drop all other outbound network communication to seal the sandbox environment
    return TC_ACT_SHOT;
}

char _license[] SEC("license") = "GPL";
