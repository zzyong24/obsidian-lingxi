<p align="center">
  <a href="./README_zh.md">🇨🇳 中文文档</a>
</p>

<h1 align="center">Lingxi</h1>

<p align="center">
  <strong>🧠 Skill-driven AI Chat Plugin — Make Obsidian Your AI Second Brain</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-blue?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/platform-Desktop%20%7C%20Mobile-orange?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/models-DeepSeek%20%7C%20Qwen%20%7C%20Doubao%20%7C%20Kimi%20%7C%20Zhipu-purple?style=flat-square" alt="Models">
</p>

<p align="center">
  Chat with AI in the Obsidian sidebar, drive your creative workflow with Skill templates, and automatically archive conversations as structured notes.<br/>
  Optimized for Chinese LLMs. All data stored locally in your Vault — zero cloud dependency.
</p>

---

## 📖 Table of Contents

- [✨ Features](#-features)
- [📸 Preview](#-preview)
- [🚀 Getting Started](#-getting-started)
  - [Installation](#installation)
  - [Configure Model API Key](#configure-model-api-key)
- [🤖 LLM Integration Guide](#-llm-integration-guide)
  - [DeepSeek](#1-deepseek)
  - [Qwen (Alibaba Cloud)](#2-qwen-alibaba-cloud)
  - [Doubao (ByteDance)](#3-doubao-bytedance)
  - [Kimi (Moonshot AI)](#4-kimi-moonshot-ai)
  - [Zhipu GLM](#5-zhipu-glm)
  - [Other Models](#6-other-models)
- [🎯 Scenes & Skill System](#-scenes--skill-system)
  - [Directory Structure](#directory-structure)
  - [Skill File Specification](#skill-file-specification)
  - [Using Skills](#using-skills)
- [🖼️ Image Input](#️-image-input)
- [☁️ Multi-device Sync: Remotely Save + Tencent Cloud COS](#️-multi-device-sync-remotely-save--tencent-cloud-cos)
- [⚙️ Settings Overview](#️-settings-overview)
- [🛠️ Developer Guide](#️-developer-guide)
- [❓ FAQ](#-faq)
- [📄 License](#-license)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🗣️ **Chat & Archive** | Conversations are automatically archived as structured notes |
| ⚡ **Skill-driven** | Define AI behavior through Markdown Skill templates — flexible and extensible |
| 🎭 **Scene Management** | Organize Skills and Rules by scene (e.g., Content Creation, Learning) with auto-matching |
| 🇨🇳 **Chinese LLM First** | Built-in support for DeepSeek / Qwen / Doubao / Kimi / Zhipu — ready out of the box |
| 🖼️ **Image Recognition** | Paste or drag images to send to vision models for analysis |
| 📡 **Streaming Output** | Real-time typewriter-style AI responses for a smooth experience |
| 🔒 **Fully Local Data** | All data stored in your Obsidian Vault — zero cloud dependency |
| 📱 **Multi-device Sync** | Sync across desktop and mobile with Remotely Save + COS |
| 🔍 **Knowledge Retrieval (RAG)** | Automatically retrieves relevant knowledge from your Vault notes, enabling AI to answer based on your notes |

---

## 📸 Preview

### Chat Interface

<!-- Screenshot placeholder: Plugin sidebar chat interface with message list, model selector, input box -->
> 📷 *Coming soon: Chat interface screenshot*

### Scene Switching

<!-- Screenshot placeholder: Scene quick-entry buttons + scene/skill context status bar -->
> 📷 *Coming soon: Scene switching screenshot*

### Settings Panel

<!-- Screenshot placeholder: Settings page showing model configuration area -->
> 📷 *Coming soon: Settings panel screenshot*

---

## 🚀 Getting Started

### Installation

#### Option 1: Community Plugin Marketplace (Recommended)

1. Open **Obsidian → Settings → Community Plugins**
2. Turn off **Restricted Mode** (if enabled)
3. Click **Browse**, search for **"Lingxi"**
4. Click **Install**, then **Enable**

#### Option 2: Manual Installation

1. Go to [GitHub Releases](https://github.com/zzyong24/obsidian-lingxi/releases) and download the latest `main.js`, `styles.css`, and `manifest.json`

2. Create the plugin directory in your Vault and place the files:
```
YourVault/.obsidian/plugins/lingxi/
   ├── main.js
   ├── styles.css
   └── manifest.json
```

3. Restart Obsidian → **Settings → Community Plugins** → Enable "Lingxi"

#### Option 3: BRAT Installation (Beta Testing)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Go to BRAT Settings → **Add Beta Plugin** → Enter this project's GitHub repo URL
3. BRAT will automatically download and install the latest version

### Configure Model API Key

1. Open **Obsidian → Settings → Lingxi**
2. Expand the model provider you want to use (e.g., DeepSeek)
3. Enter your **API Key** (see the guides below for each model)
4. Click **"Test Connection"** to verify ✅
5. Select the configured model in the "Default Model" section

> 💡 You only need to configure at least one model to get started. We recommend starting with **DeepSeek** for the best cost-performance ratio.

---

## 🤖 LLM Integration Guide

This plugin supports all LLM services compatible with the OpenAI API format. Below are detailed integration guides for 5 major Chinese LLM providers.

### 1. DeepSeek

> 🌟 **Recommended** — Excellent cost-performance ratio, strong Chinese language capabilities, 128K context

**Get API Key:**

1. Visit [DeepSeek Platform](https://platform.deepseek.com/)
2. Register/Login
3. Go to **"API Keys"** page
4. Click **"Create API Key"**, copy and save

**Plugin Configuration:**

| Setting | Value |
|---------|-------|
| Base URL | `https://api.deepseek.com/v1` |
| Default Model | `deepseek-chat` |
| API Key | Your created key |

**Available Models:**

| Model | Description | Context |
|-------|-------------|---------|
| `deepseek-chat` | General chat, best value | 128K |
| `deepseek-reasoner` | Deep reasoning model | 128K |

**Pricing:** New users receive free credits. Regular usage costs approximately ¥1/million tokens (input) — extremely affordable.

---

### 2. Qwen (Alibaba Cloud)

> Alibaba Cloud's LLM, multiple tiers available, generous free quota

**Get API Key:**

1. Visit [Alibaba Cloud Dashscope](https://dashscope.console.aliyun.com/)
2. Register/Login with an Alibaba Cloud account
3. Activate "Model Service Lingji"
4. Go to **"API-KEY Management"** page
5. Click **"Create New API-KEY"**, copy and save

**Plugin Configuration:**

| Setting | Value |
|---------|-------|
| Base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| Default Model | `qwen-plus` |
| API Key | Your created key |

**Available Models:**

| Model | Description | Context |
|-------|-------------|---------|
| `qwen-turbo` | Lightweight and fast | 128K |
| `qwen-plus` | Balanced choice | 128K |
| `qwen-max` | Most powerful | 32K |
| `qwen-vl-plus` | Vision model (image support) | 32K |

**Pricing:** Free quota available. `qwen-turbo` has the most generous free tier.

---

### 3. Doubao (ByteDance)

> ByteDance's LLM, accessed through Volcengine Ark platform

**Get API Key:**

1. Visit [Volcengine Console](https://console.volcengine.com/ark)
2. Register/Login with a Volcengine account
3. Activate "Model Inference" service
4. Create a key in **"API Key Management"**
5. Create an inference endpoint in **"Online Inference"**, note the **Endpoint ID**

> ⚠️ **Note**: Doubao uses your **Endpoint ID** (like `ep-xxx`) as the model name, not the generic model name.

**Plugin Configuration:**

| Setting | Value |
|---------|-------|
| Base URL | `https://ark.cn-beijing.volces.com/api/v3` |
| Default Model | `Your Endpoint ID` (e.g., `ep-20240xxxxx`) |
| API Key | Your created key |

**Available Models:**

| Model | Description |
|-------|-------------|
| Doubao-pro-32k | General chat, 32K context |
| Doubao-pro-128k | Long text chat, 128K context |
| Doubao-lite-32k | Lightweight and fast |
| Doubao-vision-pro | Vision model (image support) |

**Pricing:** New users receive free credits, competitively priced.

---

### 4. Kimi (Moonshot AI)

> Known for ultra-long context support up to 200K tokens, ideal for long document processing

**Get API Key:**

1. Visit [Moonshot Platform](https://platform.moonshot.cn/)
2. Register/Login
3. Go to **"API Key Management"**
4. Click **"Create"**, copy and save

**Plugin Configuration:**

| Setting | Value |
|---------|-------|
| Base URL | `https://api.moonshot.cn/v1` |
| Default Model | `moonshot-v1-32k` |
| API Key | Your created key |

**Available Models:**

| Model | Description | Context |
|-------|-------------|---------|
| `moonshot-v1-8k` | Lightweight and fast | 8K |
| `moonshot-v1-32k` | Balanced choice | 32K |
| `moonshot-v1-128k` | Ultra-long context | 128K |

**Pricing:** Free quota available, pay-as-you-go.

---

### 5. Zhipu GLM

> Tsinghua-backed LLM, GLM-4 series with comprehensive capabilities

**Get API Key:**

1. Visit [Zhipu Open Platform](https://open.bigmodel.cn/)
2. Register/Login
3. Go to **"API Keys"** page
4. Click **"Create API Key"**, copy and save

**Plugin Configuration:**

| Setting | Value |
|---------|-------|
| Base URL | `https://open.bigmodel.cn/api/paas/v4` |
| Default Model | `glm-4` |
| API Key | Your created key |

**Available Models:**

| Model | Description | Context |
|-------|-------------|---------|
| `glm-4` | Flagship model | 128K |
| `glm-4-flash` | Fast version (free) | 128K |
| `glm-4v` | Vision model (image support) | 2K |

**Pricing:** `glm-4-flash` is completely free, great for daily use.

---

### 6. Other Models

This plugin is compatible with all **OpenAI API format** model services, including but not limited to:

| Service | Base URL Example | Description |
|---------|-----------------|-------------|
| OpenAI | `https://api.openai.com/v1` | Requires international network access |
| OpenRouter | `https://openrouter.ai/api/v1` | Multi-model aggregation proxy |
| Ollama (Local) | `http://localhost:11434/v1` | Locally deployed open-source models |
| LM Studio (Local) | `http://localhost:1234/v1` | Locally deployed open-source models |
| Custom Proxy | Your proxy URL | Self-hosted API proxy service |

Simply modify any provider's **Base URL** and **Model Name** in the settings panel to connect.

---

## 🎯 Scenes & Skill System

Lingxi's core feature is its **Scene-based Skill System** — define AI roles, behaviors, and output formats through Markdown files, organized by scenes.

### Directory Structure

```
YourVault/
└── skills-scenes/                    # Scene root directory (configurable in settings)
    ├── _global_rules/                # 🌐 Global Rules (shared across all scenes)
    │   └── general-assistant-rules.md
    ├── _scenes_index.md              # 📋 Scene index (helps AI auto-match scenes)
    │
    ├── content-creation/             # 📱 Scene: Content Creation
    │   ├── _scene.md                 # Scene description + workflow + Skills overview
    │   ├── _rules/                   # Scene-level rules
    │   │   ├── persona.md
    │   │   ├── methodology.md
    │   │   └── ...
    │   └── _skills/                  # Scene-level Skills
    │       ├── topic-management/
    │       │   ├── topic-discovery.md
    │       │   └── topic-refinement.md
    │       ├── content-writing/
    │       │   ├── draft-generation.md
    │       │   └── content-rewriting.md
    │       └── ...
    │
    └── learning/                     # 📚 Scene: Learning Notes
        ├── _scene.md
        ├── _rules/
        └── _skills/
```

### System Prompt Loading Strategy

The plugin uses a **multi-layer stacking** approach to build the complete System Prompt:

```
┌─────────────────────────────┐
│  Layer 0: Current Time         │  ← Auto-injected (prevents AI time hallucination)
│  Layer 1: Global Rules         │  ← _global_rules/*.md (loaded for every conversation)
│  Layer 2: Scene Rules          │  ← content-creation/_rules/*.md (loaded when scene is selected)
│  Layer 3: Skill Prompt         │  ← topic-discovery.md's System Prompt section
│  Layer 4: RAG Knowledge Context│  ← Related content retrieved from Vault notes
└─────────────────────────────┘
                ↓
         Final System Prompt
```

### Skill File Specification

Each Skill is a `.md` file containing Frontmatter metadata and a System Prompt:

```markdown
---
name: Topic Discovery
description: Help you discover content ideas from trends, comments, and competitors
trigger_keywords: ["topic", "ideas", "trends"]
category: Topic Management
output_folder: _ai_output/topics
output_template: note
model_preference: text
---

## System Prompt

You are a senior content strategist...

(Full system prompt)

## Output Format

Please output in the following structure:
1. Topic Direction
2. Specific Angle
3. Viral Potential Score
```

**Frontmatter Field Reference:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | string | ✅ | Display name of the Skill |
| `description` | string | ✅ | Brief description |
| `trigger_keywords` | string[] | ❌ | Keywords for auto-matching |
| `category` | string | ❌ | Category name (used for panel grouping) |
| `output_folder` | string | ❌ | Archive target folder |
| `output_template` | `card` / `note` / `raw` | ❌ | Output template type |
| `model_preference` | `text` / `vision` / `any` | ❌ | Model preference |

### Using Skills

**Method 1: Auto-matching by Keywords**

Simply type a message containing Skill keywords (e.g., "Help me find trending topics for today"), and the plugin will automatically match the "Topic Discovery" Skill, responding with the corresponding System Prompt and output format.

**Method 2: Scene Quick Entry**

Click scene buttons on the welcome page (e.g., "📱 Content Creation") to quickly enter the corresponding scene context. Scene Rules and Skills are activated automatically.

---

## 🖼️ Image Input

Send images to vision models for analysis:

- **Paste images**: Directly `Ctrl/Cmd + V` to paste images from clipboard
- **Drag & drop**: Drag image files into the input area
- Images are previewed as thumbnails; multiple images supported
- Images are sent to the model in base64 format

> ⚠️ Image functionality requires selecting a vision-capable model in "Default Vision Model", such as `qwen-vl-plus`, `glm-4v`, or `doubao-vision-pro`.

---

## ☁️ Multi-device Sync: Remotely Save + Tencent Cloud COS

Use the **Remotely Save** plugin + **Tencent Cloud Object Storage (COS)** to sync your Obsidian Vault across desktop, mobile, and tablet in real-time.

### Why COS

| Solution | Pros | Cons |
|----------|------|------|
| iCloud | Native support | Apple devices only, no Android/Windows |
| OneDrive | Microsoft native | Slow in China, frequent sync failures |
| **Tencent Cloud COS** | **Fast in China, stable, affordable** | Requires simple setup |
| Alibaba Cloud OSS | Stable in China | Similar setup, also a good option |

**Pricing:** Personal note storage is minimal. COS standard storage costs about **¥0.1/GB/month** — less than ¥1/month for 10GB of notes. New users typically get free quota.

### Setup Steps

1. **Create a COS Bucket** at [Tencent Cloud COS Console](https://console.cloud.tencent.com/cos)
   - Set access permission to **Private Read/Write** ⚠️
   - Note the bucket name and region

2. **Create API Credentials** at [Tencent Cloud API Key Management](https://console.cloud.tencent.com/cam/capi)
   - Note the **SecretId** and **SecretKey**

3. **Install & Configure Remotely Save**
   - Install from Obsidian Community Plugins
   - Set remote service type to **S3 or S3-compatible**
   - Configure S3 Endpoint: `cos.{your-region}.myqcloud.com`
   - Fill in your credentials and bucket name
   - Click **"Check"** to test the connection

4. **Multi-device Usage**
   - Install Obsidian + Remotely Save on each device
   - Configure the same COS connection info
   - First sync will pull all data from the cloud

> 💡 **Tip**: Lingxi settings (including API Keys) are stored in `.obsidian/plugins/lingxi/data.json` and will sync to all devices via Remotely Save. Configure once, use everywhere.

### Sync Tips

1. **Avoid editing the same file on multiple devices simultaneously** to prevent conflicts
2. **Before first sync**, ensure the new device's Vault is empty (or contains only default files)
3. **Plugin files** (`.obsidian/plugins/`) are also synced, so all installed plugins transfer automatically
4. If sync conflicts occur, Remotely Save keeps both versions for manual resolution
5. Enable **"Sync on Startup"** to ensure you always get the latest data

---

## ⚙️ Settings Overview

| Category | Setting | Type | Default |
|----------|---------|------|---------|
| **Models** | Provider API Keys | Password | Empty |
| | Provider Base URLs | Text | Pre-filled with official URLs |
| | Default Text Model | Dropdown | `deepseek:deepseek-chat` |
| | Default Vision Model | Dropdown | Empty |
| **Scenes** | Scene Root Directory | Text | `skills-scenes` |
| **Archive** | Default Archive Folder | Text | `_ai_output` |
| | Auto-archive in Skill Mode | Toggle | On |
| **Knowledge Retrieval** | Enable RAG | Toggle | Off |
| | Embedding Provider | Dropdown | Empty |
| | Embedding Model | Text | `text-embedding-v3` |
| | Retrieval Top K | Slider | 3 |
| | Similarity Threshold | Slider | 0.3 |
| **Interface** | Send Shortcut | Dropdown | Enter |
| | Streaming Output | Toggle | On |
| | Temperature | Slider | 0.7 |
| | Context Messages | Slider | 20 |

---

## 🛠️ Developer Guide

### Tech Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript |
| UI | React 18 |
| Model Integration | OpenAI-compatible API |
| Data Storage | Local Vault Markdown |
| Build Tool | esbuild |

### Local Development

```bash
# Clone the project
git clone https://github.com/zzyong24/obsidian-lingxi.git
cd obsidian-lingxi

# Install dependencies
npm install

# Development mode (auto-rebuild on file changes)
npm run dev

# Production build
npm run build
```

### Debugging

1. Create a symlink to your Vault's plugin directory:
   ```bash
   ln -s /path/to/obsidian-lingxi /path/to/vault/.obsidian/plugins/lingxi
   ```

2. Run `npm run dev`

3. In Obsidian, press `Cmd/Ctrl + R` to reload the plugin

4. Press `Cmd + Option + I` (macOS) or `Ctrl + Shift + I` (Windows) to open Developer Tools

### Project Structure

```
src/
├── main.ts                    # Plugin entry point
├── types.ts                   # Global type definitions + default settings
├── constants.ts               # Constants
├── settings.ts                # Settings management
├── providers/
│   ├── OpenAICompatible.ts    # OpenAI-compatible Provider (covers all models)
│   └── ProviderRegistry.ts    # Provider registration & management
├── skills/
│   ├── SceneManager.ts        # Scene-based Skill/Rules management
│   └── SkillManager.ts        # Legacy Skill management (compatibility)
├── search/
│   ├── EmbeddingService.ts    # Embedding vectorization service
│   ├── VectorStore.ts         # Local vector storage (JSON)
│   └── RAGManager.ts          # RAG retrieval orchestrator
├── conversation/
│   └── ConversationManager.ts # Conversation context management
├── archive/
│   └── AutoArchiver.ts        # Auto-archive to Vault
└── ui/
    ├── ChatView.tsx           # Obsidian sidebar view
    ├── Chat.tsx               # Chat interface main component
    ├── MessageBubble.tsx      # Message bubble
    ├── InputArea.tsx          # Input area
    ├── ModelSelector.tsx      # Model switcher
    └── SettingsPanel.tsx      # Settings panel
```

---

## ❓ FAQ

<details>
<summary><strong>Q: "Please configure a model API Key first"?</strong></summary>

Go to **Settings → Lingxi**, configure a valid API Key for at least one model provider, and select that provider in the "Default Model" section.
</details>

<details>
<summary><strong>Q: Streaming output not working / response stuck?</strong></summary>

1. Try disabling "Streaming Output" in settings and use non-streaming mode
2. Check network proxy settings (VPN may interfere)
3. Verify your API Key is valid and has remaining quota
4. Open Developer Console (`Cmd+Option+I`) to check error logs
</details>

<details>
<summary><strong>Q: Skill files not being loaded?</strong></summary>

1. Confirm files are in the scene directory specified in settings (default `skills-scenes/`)
2. Files must be in `.md` format
3. Files must contain valid Frontmatter (YAML header wrapped in `---`)
4. Files must contain a `## System Prompt` section
5. Open Developer Console and check `[Lingxi]` related logs
</details>

<details>
<summary><strong>Q: Where are archived notes?</strong></summary>

By default, notes are archived to the `_output/` subfolder under the corresponding scene directory (e.g., `skills-scenes/content-creation/_output/drafts/`). If no scene is associated, it falls back to the `_ai_output/` folder. All paths are configurable in settings.
</details>

<details>
<summary><strong>Q: How to use locally deployed models (Ollama, etc.)?</strong></summary>

In the settings panel, change any provider's **Base URL** to your local service address (e.g., `http://localhost:11434/v1`), as long as the service is compatible with the OpenAI API format.
</details>

<details>
<summary><strong>Q: Remotely Save sync failed?</strong></summary>

1. Check if the COS SecretId / SecretKey are correct
2. Verify the bucket name includes the APPID suffix (full name)
3. Confirm S3 Endpoint format is `cos.{region}.myqcloud.com`
4. Check if the Tencent Cloud account has outstanding balance
5. Click Remotely Save's "Check" button to re-test the connection
</details>

<details>
<summary><strong>Q: Plugin settings lost after multi-device sync?</strong></summary>

Lingxi settings are stored in `.obsidian/plugins/lingxi/data.json`. Make sure Remotely Save is not excluding the `.obsidian` directory. Restart Obsidian after sync completes to load the new settings.
</details>

---

## 🙏 Acknowledgements

- [Obsidian](https://obsidian.md/) — Powerful local-first knowledge management tool
- [Obsidian Copilot](https://github.com/logancyang/obsidian-copilot) — Architectural inspiration for Lingxi
- [Remotely Save](https://github.com/remotely-save/remotely-save) — Core plugin for multi-device sync
- [DeepSeek](https://deepseek.com/), [Qwen](https://tongyi.aliyun.com/), [Doubao](https://www.volcengine.com/product/doubao), [Kimi](https://kimi.moonshot.cn/), [Zhipu](https://www.zhipuai.cn/) — Excellent Chinese LLM providers

---

## 📄 License

[MIT License](./LICENSE)

---

<p align="center">
  If Lingxi helps you, please consider giving it a ⭐ Star!
</p>
