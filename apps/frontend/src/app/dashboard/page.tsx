"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const throughputData = [
  { time: "00:00", tokens: 1200 },
  { time: "02:00", tokens: 900 },
  { time: "04:00", tokens: 600 },
  { time: "06:00", tokens: 1500 },
  { time: "08:00", tokens: 2800 },
  { time: "10:00", tokens: 4200 },
  { time: "12:00", tokens: 3900 },
  { time: "14:00", tokens: 4600 },
  { time: "16:00", tokens: 5200 },
  { time: "18:00", tokens: 4800 },
  { time: "20:00", tokens: 3400 },
  { time: "22:00", tokens: 2100 },
];

export default function DashboardPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [metrics, setMetrics] = useState<any>({
    inferenceLoad: 4800,
    avgRequestLatency: 284,
    activeSandboxes: 0,
    routingHitRate: 98.2,
    activeKeysCount: 0,
    totalKeysCount: 0,
    memoryUsedPercent: 0,
    chartData: throughputData,
    latencyData: [
      { endpoint: "Model Forward", latency: 85 },
      { endpoint: "Top-2 Routing", latency: 12 },
      { endpoint: "AST Parser", latency: 25 },
      { endpoint: "Sandbox Init", latency: 150 },
      { endpoint: "Sandbox Execute", latency: 284 },
    ]
  });

  useEffect(() => {
    setIsMounted(true);

    const fetchMetrics = async () => {
      try {
        const response = await fetch("/api/v1/metrics");
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error("Failed to load live metrics:", error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12 flex flex-col gap-10 w-full min-h-screen bg-[#060606] text-white">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent">
          Telemetry & Performance Analytics
        </h1>
        <p className="text-neutral-400 text-xs mt-2.5 font-medium">
          Live diagnostics and latency telemetry for the CodexForge sandboxed compiler execution VM layer.
        </p>
      </div>

      {/* Grid: Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        
        {/* Inference Load */}
        <div className="bg-[#0c0c0c] border border-[#1f1f1f] p-6 rounded-3xl relative overflow-hidden group hover:border-neutral-700 transition-all duration-300">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">
            Inference Load
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-white">
              {metrics.inferenceLoad.toLocaleString()}
            </span>
            <span className="text-xs text-neutral-400 font-semibold">T/sec</span>
          </div>
          <p className="text-neutral-500 text-[10px] mt-2 font-medium">Active tokens generated per second</p>
        </div>

        {/* Avg Request Latency */}
        <div className="bg-[#0c0c0c] border border-[#1f1f1f] p-6 rounded-3xl relative overflow-hidden group hover:border-neutral-700 transition-all duration-300">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">
            Avg Sandbox Latency
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-white">
              {metrics.avgRequestLatency}
            </span>
            <span className="text-xs text-neutral-400 font-semibold">ms</span>
          </div>
          <p className="text-neutral-500 text-[10px] mt-2 font-medium">Isolated virtual sandbox runtime duration</p>
        </div>

        {/* Active Keys */}
        <div className="bg-[#0c0c0c] border border-[#1f1f1f] p-6 rounded-3xl relative overflow-hidden group hover:border-neutral-700 transition-all duration-300">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">
            Active Tokens
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-white">
              {metrics.activeKeysCount}
            </span>
            <span className="text-xs text-neutral-500 font-semibold">
              / {metrics.totalKeysCount} Issued
            </span>
          </div>
          <p className="text-neutral-500 text-[10px] mt-2 font-medium">Hashed credentials mapped to your user ID</p>
        </div>

        {/* Host RAM Utilization */}
        <div className="bg-[#0c0c0c] border border-[#1f1f1f] p-6 rounded-3xl relative overflow-hidden group hover:border-neutral-700 transition-all duration-300">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">
            System Resource Load
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-white">
              {metrics.memoryUsedPercent}%
            </span>
            <span className="text-xs text-neutral-400 font-semibold">Memory</span>
          </div>
          <p className="text-neutral-500 text-[10px] mt-2 font-medium">Memory utilized on isolation execution host</p>
        </div>

      </div>

      {/* Grid: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
        
        {/* Throughput Area Chart */}
        <div className="bg-[#0c0c0c] border border-[#1f1f1f] p-6 rounded-3xl flex flex-col h-[400px] w-full">
          <h3 className="text-xs font-bold text-white mb-6 uppercase tracking-wider">Token Generation Throughput</h3>
          <div className="flex-1 w-full text-xs">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#525252" tickLine={false} style={{ fontSize: '10px', fontWeight: '600' }} />
                  <YAxis stroke="#525252" tickLine={false} style={{ fontSize: '10px', fontWeight: '600' }} />
                  <Tooltip
                    cursor={{ stroke: '#262626', strokeWidth: 1 }}
                    contentStyle={{
                      backgroundColor: "#0c0c0c",
                      borderColor: "#1f1f1f",
                      borderRadius: "16px",
                      borderWidth: "1px",
                    }}
                    itemStyle={{ color: "#fff", fontSize: "11px", fontWeight: "600" }}
                    labelStyle={{ color: "#888", fontSize: "10px", fontWeight: "600" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="#ffffff"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTokens)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-neutral-600 font-semibold">Loading Telemetry Chart...</div>
            )}
          </div>
        </div>

        {/* Latency Bar Chart */}
        <div className="bg-[#0c0c0c] border border-[#1f1f1f] p-6 rounded-3xl flex flex-col h-[400px] w-full">
          <h3 className="text-xs font-bold text-white mb-6 uppercase tracking-wider">Sub-system Latencies</h3>
          <div className="flex-1 w-full text-xs">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.latencyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="endpoint" stroke="#525252" tickLine={false} style={{ fontSize: '10px', fontWeight: '600' }} />
                  <YAxis stroke="#525252" tickLine={false} unit="ms" style={{ fontSize: '10px', fontWeight: '600' }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.03)', radius: 8 }}
                    contentStyle={{
                      backgroundColor: "#0c0c0c",
                      borderColor: "#1f1f1f",
                      borderRadius: "16px",
                      borderWidth: "1px",
                    }}
                    itemStyle={{ color: "#fff", fontSize: "11px", fontWeight: "600" }}
                    labelStyle={{ color: "#888", fontSize: "10px", fontWeight: "600" }}
                  />
                  <Bar 
                    dataKey="latency" 
                    fill="#ffffff" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={30} 
                    fillOpacity={0.7} 
                    activeBar={{ fill: "#ffffff", fillOpacity: 1 }} 
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-neutral-600 font-semibold">Loading Latency Chart...</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
