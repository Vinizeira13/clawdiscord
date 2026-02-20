"use client";

import { useState, useEffect, useRef } from "react";

/* ─── ANIMATED COUNTER ─── */
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const step = Math.ceil(target / 40);
          const interval = setInterval(() => {
            start += step;
            if (start >= target) {
              setCount(target);
              clearInterval(interval);
            } else {
              setCount(start);
            }
          }, 30);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ─── TYPEWRITER ─── */
function Typewriter({ texts }: { texts: string[] }) {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = texts[index];
    const timeout = deleting ? 30 : 60;

    if (!deleting && displayed === current) {
      setTimeout(() => setDeleting(true), 2000);
      return;
    }
    if (deleting && displayed === "") {
      setDeleting(false);
      setIndex((i) => (i + 1) % texts.length);
      return;
    }

    const timer = setTimeout(() => {
      setDisplayed(
        deleting
          ? current.substring(0, displayed.length - 1)
          : current.substring(0, displayed.length + 1)
      );
    }, timeout);

    return () => clearTimeout(timer);
  }, [displayed, deleting, index, texts]);

  return (
    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
      {displayed}
      <span className="animate-pulse text-indigo-400">|</span>
    </span>
  );
}

/* ─── FAKE TERMINAL ─── */
function Terminal() {
  const lines = [
    { text: "$ clawdiscord setup --template gaming", delay: 0, color: "text-green-400" },
    { text: "", delay: 800, color: "" },
    { text: "  🐾 ClawDiscord v0.1.0", delay: 1000, color: "text-indigo-400" },
    { text: "  ━━━━━━━━━━━━━━━━━━━━━━━━━", delay: 1200, color: "text-gray-600" },
    { text: "", delay: 1300, color: "" },
    { text: "  ✓ Connected to server: My Gaming Hub", delay: 1500, color: "text-white" },
    { text: "  ✓ Creating 20 roles...", delay: 2000, color: "text-white" },
    { text: "  ✓ Creating 7 categories...", delay: 2800, color: "text-white" },
    { text: "  ✓ Creating 36 channels...", delay: 3600, color: "text-white" },
    { text: "  ✓ Sending 8 embeds...", delay: 4400, color: "text-white" },
    { text: "  ✓ Applying permissions...", delay: 5000, color: "text-white" },
    { text: "", delay: 5500, color: "" },
    { text: "  ✅ Setup complete in 11.2s!", delay: 5800, color: "text-green-400 font-bold" },
    { text: "  📊 20 roles · 7 categories · 36 channels · 8 embeds", delay: 6200, color: "text-gray-400" },
  ];

  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (visible >= lines.length) return;
    const timer = setTimeout(
      () => setVisible((v) => v + 1),
      lines[visible]?.delay
        ? lines[visible].delay - (visible > 0 ? lines[visible - 1].delay : 0)
        : 300
    );
    return () => clearTimeout(timer);
  }, [visible, lines.length]);

  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d14] p-5 font-mono text-sm shadow-2xl shadow-indigo-500/5 overflow-hidden">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#1e1e2e]">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-gray-500 text-xs">Terminal — clawdiscord</span>
      </div>
      <div className="space-y-1">
        {lines.slice(0, visible).map((line, i) => (
          <div key={i} className={`${line.color} leading-relaxed`}>
            {line.text || "\u00A0"}
          </div>
        ))}
        {visible < lines.length && (
          <span className="inline-block w-2.5 h-5 bg-green-400 animate-pulse" />
        )}
      </div>
    </div>
  );
}

/* ─── AI CHAT DEMO ─── */
function AIChatDemo() {
  const msgs = [
    {
      role: "user" as const,
      text: "I need a crypto trading community for 500+ members with trading signals and portfolio channels",
    },
    {
      role: "ai" as const,
      text: "Got it! I'll design a server with:\n\n📁 8 categories — Welcome, Trading Floor, Signals Premium, Analysis, Portfolio, Education, Voice, Staff\n\n💬 32 channels — price-alerts, btc-analysis, eth-analysis, altcoin-gems, trading-journal, portfolio-share...\n\n👥 12 roles — Diamond Hands, Whale, Day Trader, Swing Trader, Analyst, Signal Provider...",
    },
    {
      role: "ai" as const,
      text: "🔒 Premium Signal channels locked to subscribers only\n📊 Forum channels for trade ideas with upvoting\n🤖 Auto-welcome embed with server guide\n\nReady to apply? This will take ~8 seconds.",
    },
  ];

  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (visible >= msgs.length) return;
    const timer = setTimeout(() => setVisible((v) => v + 1), visible === 0 ? 1500 : 2500);
    return () => clearTimeout(timer);
  }, [visible, msgs.length]);

  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d14] p-5 shadow-2xl shadow-purple-500/5 overflow-hidden">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#1e1e2e]">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs">
          🐾
        </div>
        <span className="text-gray-400 text-sm font-medium">ClawDiscord AI Agent</span>
        <span className="ml-auto text-xs text-green-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Online
        </span>
      </div>
      <div className="space-y-4 min-h-[280px]">
        {msgs.slice(0, visible).map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-[#161622] text-gray-300 border border-[#1e1e2e] rounded-bl-sm"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {visible < msgs.length && (
          <div className="flex justify-start">
            <div className="bg-[#161622] border border-[#1e1e2e] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        {visible >= msgs.length && (
          <div className="flex justify-center pt-2">
            <button className="px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95">
              ✨ Apply to Server
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── FEATURE CARD ─── */
function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="group p-6 rounded-xl bg-[#111118] border border-[#1e1e2e] hover:border-indigo-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

/* ─── TEMPLATE CARD ─── */
function TemplateCard({
  name,
  icon,
  channels,
  roles,
  categories,
  tags,
}: {
  name: string;
  icon: string;
  channels: number;
  roles: number;
  categories: number;
  tags: string[];
}) {
  return (
    <div className="group p-6 rounded-xl bg-[#111118] border border-[#1e1e2e] hover:border-indigo-500/30 transition-all duration-300">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-lg font-semibold text-white">{name}</h3>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 rounded-lg bg-[#0a0a0f]">
          <div className="text-indigo-400 font-bold">{channels}</div>
          <div className="text-gray-500 text-xs">channels</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-[#0a0a0f]">
          <div className="text-purple-400 font-bold">{roles}</div>
          <div className="text-gray-500 text-xs">roles</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-[#0a0a0f]">
          <div className="text-emerald-400 font-bold">{categories}</div>
          <div className="text-gray-500 text-xs">categories</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── PRICING CARD ─── */
function PricingCard({
  name,
  price,
  period,
  features,
  cta,
  popular,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  popular?: boolean;
}) {
  return (
    <div
      className={`relative p-6 rounded-xl border transition-all duration-300 ${
        popular
          ? "bg-gradient-to-b from-indigo-500/10 to-purple-500/5 border-indigo-500/40 shadow-lg shadow-indigo-500/10"
          : "bg-[#111118] border-[#1e1e2e] hover:border-indigo-500/20"
      }`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-xs font-semibold">
          Most Popular
        </div>
      )}
      <h3 className="text-lg font-semibold text-white mb-1">{name}</h3>
      <div className="mb-4">
        <span className="text-3xl font-bold text-white">{price}</span>
        <span className="text-gray-400 text-sm">{period}</span>
      </div>
      <ul className="space-y-2 mb-6">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
            <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <button
        className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
          popular
            ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98]"
            : "bg-[#1e1e2e] text-white hover:bg-[#2a2a3e]"
        }`}
      >
        {cta}
      </button>
    </div>
  );
}

/* ─── MAIN PAGE ─── */
export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Gradient background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/8 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-purple-600/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-indigo-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between max-w-6xl mx-auto px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐾</span>
          <span className="font-bold text-lg tracking-tight">ClawDiscord</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#templates" className="hover:text-white transition">Templates</a>
          <a href="#pricing" className="hover:text-white transition">Pricing</a>
          <a href="#how" className="hover:text-white transition">How It Works</a>
        </div>
        <a
          href="#"
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-all hover:shadow-lg hover:shadow-indigo-500/25"
        >
          Get Started
        </a>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          AI-Powered Discord Automation
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
          Your Discord Server,
          <br />
          <Typewriter
            texts={[
              "Built in Seconds.",
              "Designed by AI.",
              "Ready to Launch.",
              "Professionally Crafted.",
            ]}
          />
        </h1>

        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Stop spending hours on manual server setup. Describe your community to our AI agent and get
          a complete Discord server with categories, channels, roles, permissions, and embeds —
          deployed automatically.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a
            href="#"
            className="group px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-lg hover:shadow-xl hover:shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95"
          >
            Start Free Setup
            <span className="ml-2 group-hover:translate-x-1 inline-block transition-transform">
              &rarr;
            </span>
          </a>
          <a
            href="#how"
            className="px-8 py-3.5 rounded-xl border border-[#2a2a3e] text-gray-300 font-semibold text-lg hover:bg-[#111118] transition-all"
          >
            See How It Works
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mb-16">
          {[
            { n: 12, s: "s", label: "Average Setup Time" },
            { n: 100, s: "+", label: "Channels Created" },
            { n: 50, s: "+", label: "Roles Configured" },
            { n: 99, s: "%", label: "Automation Rate" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-white">
                <AnimatedNumber target={stat.n} suffix={stat.s} />
              </div>
              <div className="text-gray-500 text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Demo area */}
        <div id="how" className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <div>
            <div className="text-sm text-gray-500 mb-3 text-left font-medium">
              ⚡ Quick Setup (CLI)
            </div>
            <Terminal />
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-3 text-left font-medium">
              🤖 AI Agent (Web)
            </div>
            <AIChatDemo />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything You Need to Launch a
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              {" "}Professional Server
            </span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            From channels to permissions, our engine handles the tedious work so you can focus on
            growing your community.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon="🤖"
            title="AI-Powered Design"
            desc="Describe your community in natural language. Our AI agent generates a complete server template custom to your needs."
          />
          <FeatureCard
            icon="⚡"
            title="Setup in Seconds"
            desc="Categories, channels, roles, permissions, embeds — all created automatically via Discord API. Average setup: 12 seconds."
          />
          <FeatureCard
            icon="🎨"
            title="Curated Templates"
            desc="Pre-built templates for Gaming, SaaS, and General communities. Each with 30-44 channels, 18-31 roles, and rich embeds."
          />
          <FeatureCard
            icon="🔒"
            title="Smart Permissions"
            desc="Dynamic permission system with staff detection, role-locked channels, read-only sections, and hidden admin areas."
          />
          <FeatureCard
            icon="📊"
            title="Real-Time Progress"
            desc="Watch your server being built live. Progress bar, phase indicators, and instant notification when it's done."
          />
          <FeatureCard
            icon="🔄"
            title="Reset & Rebuild"
            desc="Not happy? One-click reset removes everything. Rebuild with a different template or custom AI design instantly."
          />
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Curated Templates</h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Start with a proven template or let AI design something unique. Every template is
            production-ready.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-8">
          <TemplateCard
            name="Gaming Community"
            icon="🎮"
            channels={36}
            roles={20}
            categories={7}
            tags={["LFG", "Tournaments", "Voice Lobbies", "Clip Sharing"]}
          />
          <TemplateCard
            name="SaaS Community"
            icon="🚀"
            channels={33}
            roles={18}
            categories={8}
            tags={["Support Forum", "Beta Testing", "Feature Requests", "Dev Corner"]}
          />
          <TemplateCard
            name="General Community"
            icon="🌍"
            channels={44}
            roles={31}
            categories={8}
            tags={["Interest Groups", "Media Share", "Voice Hangouts", "Color Roles"]}
          />
        </div>

        <div className="text-center">
          <div className="inline-flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
            <span className="text-2xl">✨</span>
            <div className="text-left">
              <div className="font-semibold text-white">AI Custom Template</div>
              <div className="text-sm text-gray-400">
                Unlimited channels, roles, and categories. Designed by AI for your exact needs.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Three Steps to a
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              {" "}Perfect Server
            </span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: "01",
              title: "Login with Discord",
              desc: "One-click OAuth2 login. No passwords, no signups. We only ask for the permissions we need.",
              icon: "🔑",
            },
            {
              step: "02",
              title: "Choose or Design",
              desc: "Pick a curated template for instant setup, or chat with our AI agent to design a custom server from scratch.",
              icon: "🎯",
            },
            {
              step: "03",
              title: "Watch It Build",
              desc: "Our bot creates everything in seconds. Channels, roles, permissions, embeds — all automated. Jump into Discord and go.",
              icon: "🚀",
            },
          ].map((item) => (
            <div key={item.step} className="relative text-center p-8">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 text-6xl font-black text-indigo-500/5">
                {item.step}
              </div>
              <div className="relative">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-gray-400 max-w-lg mx-auto">
            Start free. Upgrade when you need more. No hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <PricingCard
            name="Free"
            price="$0"
            period="/forever"
            features={[
              "1 server setup per month",
              "Basic templates (3 included)",
              "Standard support",
              "Community access",
            ]}
            cta="Get Started Free"
          />
          <PricingCard
            name="Pro"
            price="$9.99"
            period="/month"
            features={[
              "Unlimited server setups",
              "AI Agent (custom designs)",
              "All templates + future ones",
              "Priority setup queue",
              "Reset & rebuild anytime",
            ]}
            cta="Start Pro Trial"
            popular
          />
          <PricingCard
            name="Pay Per Use"
            price="$4.99"
            period="/setup"
            features={[
              "No subscription needed",
              "AI Agent included",
              "All templates available",
              "Pay only when you build",
            ]}
            cta="Buy a Setup"
          />
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="p-12 rounded-2xl bg-gradient-to-b from-indigo-500/10 to-purple-500/5 border border-indigo-500/20">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Build Your Server?</h2>
          <p className="text-gray-400 text-lg mb-8 max-w-lg mx-auto">
            Join the community that stopped wasting hours on manual Discord setup. Your professional
            server is one click away.
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-lg hover:shadow-xl hover:shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95"
          >
            🐾 Start Building Free
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#1e1e2e] mt-12">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">🐾</span>
              <span className="font-bold">ClawDiscord</span>
              <span className="text-gray-500 text-sm ml-2">&copy; 2026</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-white transition">Terms</a>
              <a href="#" className="hover:text-white transition">Privacy</a>
              <a href="#" className="hover:text-white transition">Support</a>
              <a href="https://github.com/Vinizeira13/clawdiscord" className="hover:text-white transition">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
