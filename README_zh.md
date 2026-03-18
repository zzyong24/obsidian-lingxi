<p align="center">
  <a href="./README.md">🇬🇧 English</a>
</p>

<h1 align="center">灵犀 · Lingxi</h1>

<p align="center">
  <strong>🧠 Skill 驱动的 AI 对话插件 — 心有灵犀，让 Obsidian 成为你的 AI 第二大脑</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-blue?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/platform-Desktop%20%7C%20Mobile-orange?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/models-DeepSeek%20%7C%20通义千问%20%7C%20豆包%20%7C%20Kimi%20%7C%20智谱-purple?style=flat-square" alt="Models">
</p>

<p align="center">
  在 Obsidian 侧边栏与 AI 对话，通过 Skill 模板驱动创作流程，自动将灵感沉淀为结构化笔记。<br/>
  心有灵犀一点通 — 国内大模型优先，数据全部存储在本地 Vault 中，零云端依赖。
</p>

---

## 📖 目录

- [✨ 功能亮点](#-功能亮点)
- [📸 效果预览](#-效果预览)
- [🚀 快速开始](#-快速开始)
  - [安装插件](#安装插件)
  - [配置模型 API Key](#配置模型-api-key)
- [🤖 国内大模型接入指南](#-国内大模型接入指南)
  - [DeepSeek](#1-deepseek)
  - [通义千问（阿里云）](#2-通义千问阿里云)
  - [豆包（字节跳动）](#3-豆包字节跳动)
  - [Kimi（月之暗面）](#4-kimi月之暗面)
  - [智谱 GLM](#5-智谱-glm)
  - [接入其他模型](#6-接入其他模型)
- [🎯 场景与 Skill 系统](#-场景与-skill-系统)
  - [目录结构](#目录结构)
  - [Skill 文件规范](#skill-文件规范)
  - [使用 Skill](#使用-skill)
- [🖼️ 图片输入](#️-图片输入)
- [☁️ 多端同步：Remotely Save + 腾讯云 COS](#️-多端同步remotely-save--腾讯云-cos)
  - [为什么选择 COS](#为什么选择-cos)
  - [第一步：创建 COS 存储桶](#第一步创建-cos-存储桶)
  - [第二步：创建 API 密钥](#第二步创建-api-密钥)
  - [第三步：安装配置 Remotely Save](#第三步安装配置-remotely-save)
  - [第四步：多端同步使用](#第四步多端同步使用)
  - [同步注意事项](#同步注意事项)
- [⚙️ 设置项一览](#️-设置项一览)
- [🛠️ 开发者指南](#️-开发者指南)
- [❓ 常见问题](#-常见问题)
- [📄 许可证](#-许可证)

---

## ✨ 功能亮点

| 特性 | 说明 |
|------|------|
| 🗣️ **对话即沉淀** | 与 AI 对话的同时，自动将内容归档为结构化笔记 |
| ⚡ **Skill 驱动** | 通过 Markdown Skill 模板定义 AI 行为，灵活可扩展 |
| 🎭 **场景化管理** | 按场景（如自媒体、学习）组织 Skills 和 Rules，自动匹配 |
| 🇨🇳 **国内模型优先** | 预置 DeepSeek / 通义千问 / 豆包 / Kimi / 智谱，开箱即用 |
| 🖼️ **图片识别** | 支持粘贴/拖拽图片，发送给视觉模型分析 |
| 📡 **流式输出** | 打字机效果实时显示 AI 回复，体验流畅 |
| 🔒 **数据全本地** | 所有数据存储在 Obsidian Vault 中，零云端依赖 |
| 📱 **多端同步** | 搭配 Remotely Save + COS 实现桌面/手机多端同步 |
| 🔍 **知识检索（RAG）** | 自动从 Vault 笔记中检索相关知识，让 AI 基于你的笔记回答 |

---

## 📸 效果预览

### 聊天界面

<!-- 截图占位：插件侧边栏聊天界面全貌，包含消息列表、模型选择、输入框 -->
> 📷 *待补充：聊天界面截图*

### 场景切换

<!-- 截图占位：场景快捷入口 + 场景/Skill 上下文状态栏 -->
> 📷 *待补充：场景切换截图*

### 设置面板

<!-- 截图占位：设置页面，显示模型配置区域 -->
> 📷 *待补充：设置面板截图*

---

## 🚀 快速开始

### 安装插件

#### 方式一：社区插件市场（推荐）

1. 打开 **Obsidian → 设置 → 第三方插件**
2. 关闭 **安全模式**（如已开启）
3. 点击 **浏览**，搜索 **「灵犀」** 或 **「Lingxi」**
4. 点击 **安装**，然后 **启用**

#### 方式二：手动安装

1. 前往 [GitHub Releases](https://github.com/zzyong24/obsidian-lingxi/releases) 下载最新版本的 `main.js`、`styles.css`、`manifest.json`

2. 在 Vault 中创建插件目录并放入文件：
```
你的Vault/.obsidian/plugins/lingxi/
   ├── main.js
   ├── styles.css
   └── manifest.json
```

3. 重启 Obsidian → **设置 → 第三方插件** → 启用「灵犀」

#### 方式三：BRAT 安装（Beta 测试）

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. BRAT 设置 → **Add Beta Plugin** → 输入本项目的 GitHub 仓库地址
3. BRAT 会自动下载并安装最新版本

### 配置模型 API Key

1. 打开 **Obsidian → 设置 → 灵犀（Lingxi）**
2. 展开你要使用的模型提供商（如 DeepSeek）
3. 填写 **API Key**（获取方式见下方各模型教程）
4. 点击 **「测试连接」** 确认配置正确 ✅
5. 在「默认模型」区域选择刚配置的模型

> 💡 至少配置一个模型即可开始使用。推荐先配置 **DeepSeek**，性价比最高。

---

## 🤖 国内大模型接入指南

本插件支持所有兼容 OpenAI API 格式的大模型服务。以下是国内 5 大主流模型的详细接入教程。

### 1. DeepSeek

> 🌟 **推荐首选** — 性价比极高，中文能力强，支持 128K 上下文

**获取 API Key：**

1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/)
2. 注册/登录账号
3. 进入 **「API Keys」** 页面
4. 点击 **「创建 API Key」**，复制保存

<!-- 截图占位：DeepSeek 平台创建 API Key 界面 -->
> 📷 *待补充：DeepSeek 平台截图*

**插件配置：**

| 配置项 | 值 |
|--------|-----|
| Base URL | `https://api.deepseek.com/v1` |
| 默认模型 | `deepseek-chat` |
| API Key | 你创建的 Key |

**可用模型：**

| 模型 | 说明 | 上下文 |
|------|------|--------|
| `deepseek-chat` | 通用对话，性价比首选 | 128K |
| `deepseek-reasoner` | 深度推理模型 | 128K |

**费用参考：** 新用户赠送额度，正式使用约 ¥1/百万 tokens（输入），极其便宜。

---

### 2. 通义千问（阿里云）

> 阿里云旗下大模型，支持多种规格，有慷慨的免费额度

**获取 API Key：**

1. 访问 [阿里云百炼平台](https://dashscope.console.aliyun.com/)
2. 注册/登录阿里云账号
3. 开通「模型服务灵积」
4. 进入 **「API-KEY 管理」** 页面
5. 点击 **「创建新的 API-KEY」**，复制保存

<!-- 截图占位：通义千问 API Key 创建界面 -->
> 📷 *待补充：通义千问平台截图*

**插件配置：**

| 配置项 | 值 |
|--------|-----|
| Base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 默认模型 | `qwen-plus` |
| API Key | 你创建的 Key |

**可用模型：**

| 模型 | 说明 | 上下文 |
|------|------|--------|
| `qwen-turbo` | 轻量快速 | 128K |
| `qwen-plus` | 均衡首选 | 128K |
| `qwen-max` | 最强能力 | 32K |
| `qwen-vl-plus` | 视觉模型（支持图片） | 32K |

**费用参考：** 有免费调用额度，`qwen-turbo` 免费额度最多。

---

### 3. 豆包（字节跳动）

> 字节跳动旗下大模型，通过火山引擎 Ark 平台接入

**获取 API Key：**

1. 访问 [火山引擎控制台](https://console.volcengine.com/ark)
2. 注册/登录火山引擎账号
3. 开通「模型推理」服务
4. 在 **「API Key 管理」** 中创建密钥
5. 在 **「在线推理」** 中创建推理接入点（Endpoint），记录 **Endpoint ID**

<!-- 截图占位：火山引擎 Ark 平台界面 -->
> 📷 *待补充：豆包平台截图*

> ⚠️ **注意**：豆包的模型名称需要使用你创建的 **Endpoint ID**（类似 `ep-xxx`），而非通用模型名。

**插件配置：**

| 配置项 | 值 |
|--------|-----|
| Base URL | `https://ark.cn-beijing.volces.com/api/v3` |
| 默认模型 | `你的 Endpoint ID`（如 `ep-20240xxxxx`） |
| API Key | 你创建的 Key |

**可用模型：**

| 模型 | 说明 |
|------|------|
| Doubao-pro-32k | 通用对话，32K 上下文 |
| Doubao-pro-128k | 长文本对话，128K 上下文 |
| Doubao-lite-32k | 轻量快速版本 |
| Doubao-vision-pro | 视觉模型（支持图片） |

**费用参考：** 新用户赠送额度，价格较为实惠。

---

### 4. Kimi（月之暗面）

> 以超长上下文著称，支持 200K tokens，适合长文档处理

**获取 API Key：**

1. 访问 [Moonshot 开放平台](https://platform.moonshot.cn/)
2. 注册/登录账号
3. 进入 **「API Key 管理」**
4. 点击 **「新建」**，复制保存

<!-- 截图占位：Kimi 平台创建 API Key 界面 -->
> 📷 *待补充：Kimi 平台截图*

**插件配置：**

| 配置项 | 值 |
|--------|-----|
| Base URL | `https://api.moonshot.cn/v1` |
| 默认模型 | `moonshot-v1-32k` |
| API Key | 你创建的 Key |

**可用模型：**

| 模型 | 说明 | 上下文 |
|------|------|--------|
| `moonshot-v1-8k` | 轻量快速 | 8K |
| `moonshot-v1-32k` | 均衡首选 | 32K |
| `moonshot-v1-128k` | 超长上下文 | 128K |

**费用参考：** 有免费额度，按量计费。

---

### 5. 智谱 GLM

> 清华系大模型，GLM-4 系列能力全面

**获取 API Key：**

1. 访问 [智谱开放平台](https://open.bigmodel.cn/)
2. 注册/登录账号
3. 进入 **「API Keys」** 页面
4. 点击 **「创建 API Key」**，复制保存

<!-- 截图占位：智谱平台 API Key 界面 -->
> 📷 *待补充：智谱平台截图*

**插件配置：**

| 配置项 | 值 |
|--------|-----|
| Base URL | `https://open.bigmodel.cn/api/paas/v4` |
| 默认模型 | `glm-4` |
| API Key | 你创建的 Key |

**可用模型：**

| 模型 | 说明 | 上下文 |
|------|------|--------|
| `glm-4` | 旗舰模型 | 128K |
| `glm-4-flash` | 快速版本（免费） | 128K |
| `glm-4v` | 视觉模型（支持图片） | 2K |

**费用参考：** `glm-4-flash` 完全免费，适合日常使用。

---

### 6. 接入其他模型

本插件兼容所有 **OpenAI API 格式** 的模型服务，包括但不限于：

| 服务 | Base URL 示例 | 说明 |
|------|--------------|------|
| OpenAI | `https://api.openai.com/v1` | 需要海外网络 |
| OpenRouter | `https://openrouter.ai/api/v1` | 聚合多模型的中转服务 |
| Ollama（本地） | `http://localhost:11434/v1` | 本地部署开源模型 |
| LM Studio（本地） | `http://localhost:1234/v1` | 本地部署开源模型 |
| 自建中转 | 你的中转地址 | 自行部署的 API 中转服务 |

只需在设置面板中修改任一提供商的 **Base URL** 和 **模型名称** 即可接入。

---

## 🎯 场景与 Skill 系统

灵犀的核心特色是 **场景化 Skill 系统** — 通过 Markdown 文件定义 AI 的角色、行为和输出格式，按场景组织管理。

### 目录结构

```
你的Vault/
└── skills-scenes/                    # 场景根目录（可在设置中修改）
    ├── _global_rules/                # 🌐 全局规则（所有场景共享）
    │   └── 通用助手规则.md
    ├── _scenes_index.md              # 📋 场景索引（帮助 AI 自动匹配场景）
    │
    ├── 自媒体/                       # 📱 场景：自媒体创作
    │   ├── _scene.md                 # 场景描述 + 工作流 + Skills 概览
    │   ├── _rules/                   # 场景级规则
    │   │   ├── 人设系统.md
    │   │   ├── 创作方法论.md
    │   │   └── ...
    │   └── _skills/                  # 场景级 Skills
    │       ├── 选题管理/
    │       │   ├── 选题收集.md
    │       │   └── 选题深化.md
    │       ├── 素材创作/
    │       │   ├── 文稿生成.md
    │       │   └── 内容改写.md
    │       └── ...
│
├── 自媒体/                           # 📁 归档：自媒体场景输出（自动创建）
│   ├── 选题管理/                     #     ← Skill output_folder
│   ├── 文稿库/
│   └── ...
│
├── 知识学习/                         # 📁 归档：知识学习场景输出
│   ├── 深度反思/
│   ├── 知识卡片/
│   └── ...
│
└── AI笔记/                           # 📁 归档：未匹配 Skill 时的默认目录
```

### System Prompt 加载策略

插件采用 **多层叠加** 的方式构建完整的 System Prompt：

```
┌─────────────────────────────┐
│  Layer 0: 当前时间           │  ← 自动注入（避免 AI 产生时间幻觉）
│  Layer 1: 全局 Rules         │  ← _global_rules/*.md（每次对话必加载）
│  Layer 2: 场景 Rules         │  ← 自媒体/_rules/*.md（选择场景后加载）
│  Layer 3: Skill Prompt       │  ← 选题收集.md 的 System Prompt 部分
│  Layer 4: RAG 知识上下文      │  ← 从 Vault 笔记中检索到的相关内容
└─────────────────────────────┘
                ↓
         最终 System Prompt
```

### 归档目录规则

AI 回复自动归档时，归档目录由 **Skill 所属场景 + Skill 的 `output_folder`** 自动确定，无需额外配置：

| 情况 | 归档路径 | 示例 |
|------|---------|------|
| 匹配到 Skill | `场景名/output_folder` | `自媒体/选题管理/` |
| 匹配到 Skill 但无 output_folder | `场景名/` | `自媒体/` |
| 未匹配到 Skill | 默认归档文件夹 | `AI笔记/` |

> 💡 归档目录以 Vault 一级目录为根，和场景名同名。例如场景「自媒体」下的 Skill「选题收集」（`output_folder: 选题管理`），归档到 `自媒体/选题管理/`。

### Skill 文件规范

每个 Skill 是一个 `.md` 文件，包含 Frontmatter 元信息和 System Prompt：

```markdown
---
name: 选题收集
description: 帮你从热点、评论区、竞品中挖掘选题灵感
trigger_keywords: ["选题", "灵感", "热点"]
category: 选题管理
output_folder: 选题管理
output_template: note
model_preference: text
---

## System Prompt

你是一个资深的短视频选题策划师...

（完整的系统提示词）

## 输出格式

请按以下结构输出：
1. 选题方向
2. 具体角度
3. 爆款潜力评分
```

**Frontmatter 字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `name` | string | ✅ | Skill 显示名称 |
| `description` | string | ✅ | 简要描述 |
| `trigger_keywords` | string[] | ❌ | 关键词自动匹配触发 |
| `category` | string | ❌ | 分类名（面板按此分组） |
| `output_folder` | string | ❌ | 归档目标文件夹 |
| `output_template` | `card` / `note` / `raw` | ❌ | 输出模板类型 |
| `model_preference` | `text` / `vision` / `any` | ❌ | 模型偏好 |

### 使用 Skill

**方式一：关键词自动匹配**

直接输入包含 Skill 关键词的消息（如「帮我收集一下今天的热点选题」），插件会自动匹配「选题收集」 Skill，并按对应的 System Prompt 和输出格式回复。

**方式二：场景快捷入口**

在欢迎页面直接点击场景按钮（如「📱 自媒体」），快速进入对应场景上下文。场景内的 Rules 和 Skill 会自动生效。

---

## 🖼️ 图片输入

支持将图片发送给视觉模型进行分析：

- **粘贴图片**：直接 `Ctrl/Cmd + V` 粘贴剪贴板中的图片
- **拖拽图片**：将图片文件拖拽到输入区域
- 图片会以缩略图预览，可以添加多张
- 发送后图片会以 base64 格式传给模型

> ⚠️ 使用图片功能需要在「默认视觉模型」中选择支持视觉的模型，如 `qwen-vl-plus`、`glm-4v`、`doubao-vision-pro`。

---

## ☁️ 多端同步：Remotely Save + 腾讯云 COS

使用 **Remotely Save** 插件 + **腾讯云对象存储（COS）** 可以实现 Obsidian Vault 在电脑、手机、平板之间的实时同步，让你随时随地使用灵犀和所有笔记。

### 为什么选择 COS

| 方案 | 优势 | 劣势 |
|------|------|------|
| iCloud | 原生支持 | 仅苹果设备，不支持 Android/Windows |
| OneDrive | 微软原生 | 国内速度慢，经常同步失败 |
| **腾讯云 COS** | **国内速度快、稳定、便宜** | 需要简单配置 |
| 阿里云 OSS | 国内稳定 | 配置类似，均可选择 |

**费用参考**：个人笔记使用量很小，COS 标准存储约 **¥0.1/GB/月**，10GB 笔记一个月不到 1 块钱。新用户通常有免费额度。

### 第一步：创建 COS 存储桶

1. 访问 [腾讯云对象存储控制台](https://console.cloud.tencent.com/cos)
2. 如果是新用户，先完成实名认证
3. 点击 **「创建存储桶」**
4. 配置如下：

   | 配置项 | 建议值 |
   |--------|--------|
   | 存储桶名称 | `obsidian-vault-sync`（自定义） |
   | 所属地域 | 选择离你最近的（如 `ap-guangzhou`） |
   | 访问权限 | **私有读写** ⚠️ 重要！不要选公开 |

5. 创建成功后，记录以下信息：
   - **存储桶名称**（如 `obsidian-vault-sync-1234567890`）
   - **所属地域**（如 `ap-guangzhou`）

<!-- 截图占位：COS 创建存储桶界面 -->
> 📷 *待补充：COS 创建存储桶截图*

### 第二步：创建 API 密钥

1. 访问 [腾讯云 API 密钥管理](https://console.cloud.tencent.com/cam/capi)
2. 点击 **「新建密钥」**
3. 记录 **SecretId** 和 **SecretKey**

<!-- 截图占位：腾讯云 API 密钥管理界面 -->
> 📷 *待补充：API 密钥管理截图*

> ⚠️ **安全提示**：SecretKey 仅显示一次，请妥善保存。建议使用 **子账号密钥**（仅授权 COS 权限），而非主账号密钥。

### 第三步：安装配置 Remotely Save

1. **安装 Remotely Save 插件**

   Obsidian → 设置 → 第三方插件 → 浏览 → 搜索 **「Remotely Save」** → 安装 → 启用

2. **配置 COS 连接**

   打开 **设置 → Remotely Save**，按以下配置：

   | 配置项 | 值 |
   |--------|-----|
   | 远程服务类型 | **S3 或兼容 S3 的服务** |
   | S3 Endpoint | `cos.{你的地域}.myqcloud.com`<br/>例如：`cos.ap-guangzhou.myqcloud.com` |
   | S3 Region | 你的地域，例如 `ap-guangzhou` |
   | S3 Access Key ID | 你的 SecretId |
   | S3 Secret Access Key | 你的 SecretKey |
   | S3 Bucket Name | 你的存储桶名称（完整名称，含 APPID 后缀） |

   <!-- 截图占位：Remotely Save 配置 S3 界面 -->
   > 📷 *待补充：Remotely Save 配置截图*

3. **测试连接**

   点击 **「Check」** 按钮，显示连接成功即可。

4. **配置自动同步**（推荐）

   | 配置项 | 建议值 |
   |--------|--------|
   | 自动同步间隔 | **5 分钟**（或根据需要调整） |
   | 启动时同步 | **开启** |
   | 同步方向 | **双向同步** |

### 第四步：多端同步使用

在每个设备上都安装 Obsidian + Remotely Save，并配置相同的 COS 连接信息：

**电脑端（Windows / macOS / Linux）**：

1. 安装 Obsidian 桌面版
2. 创建或打开 Vault
3. 安装并配置 Remotely Save（同上）
4. 首次同步会自动拉取云端数据

**手机端（iOS / Android）**：

1. 安装 Obsidian 移动版
2. 创建新 Vault（名称需与桌面端一致）
3. 安装 Remotely Save 并配置相同的 COS 连接信息
4. 手动触发一次同步，所有笔记和插件设置都会同步过来

> 💡 **提示**：灵犀插件的设置（包括 API Key）存储在 Vault 的 `.obsidian/plugins/lingxi/data.json` 中，会跟随 Remotely Save 同步到所有设备。配置一次，多端可用。

### 同步注意事项

1. **避免同时在多台设备编辑同一文件**，以防冲突
2. **首次同步前**，确保新设备的 Vault 是空的（或仅包含默认文件）
3. **插件文件**（`.obsidian/plugins/`）也会被同步，所以安装的所有插件都会自动同步到新设备
4. 如果遇到同步冲突，Remotely Save 会保留两个版本，需手动处理
5. 建议开启 **「启动时同步」**，确保每次打开 Obsidian 都获取最新数据

---

## ⚙️ 设置项一览

| 分类 | 设置项 | 类型 | 默认值 |
|------|--------|------|--------|
| **模型** | 各提供商 API Key | 密码框 | 空 |
| | 各提供商 Base URL | 文本框 | 预填官方地址 |
| | 默认文本模型 | 下拉 | `deepseek:deepseek-chat` |
| | 默认视觉模型 | 下拉 | 空 |
| **场景** | 场景根目录路径 | 文本框 | `skills-scenes` |
| **归档** | 默认归档文件夹 | 文本框 | `AI笔记` |
| | 自动归档 AI 回复 | 开关 | 开启（所有 AI 回复自动归档） |
| **知识检索** | 启用知识检索（RAG） | 开关 | 关闭 |
| | Embedding 提供商 | 下拉 | 空 |
| | Embedding 模型 | 文本框 | `text-embedding-v3` |
| | 检索结果数量 | 滑块 | 3 |
| | 相似度阈值 | 滑块 | 0.3 |
| **界面** | 发送快捷键 | 下拉 | Enter |
| | 流式输出 | 开关 | 开启 |
| | 温度 | 滑块 | 0.7 |
| | 上下文消息数 | 滑块 | 20 |

---

## 🛠️ 开发者指南

### 技术栈

| 层级 | 选型 |
|------|------|
| 语言 | TypeScript |
| UI | React 18 |
| 模型接入 | OpenAI 兼容 API |
| 数据存储 | Vault 本地 Markdown |
| 构建 | esbuild |

### 本地开发

```bash
# 克隆项目
git clone https://github.com/zzyong24/obsidian-lingxi.git
cd obsidian-lingxi

# 安装依赖
npm install

# 开发模式（文件变更自动重建）
npm run dev

# 生产构建
npm run build
```

### 调试方式

1. 创建符号链接到 Vault 插件目录：
   ```bash
   ln -s /path/to/obsidian-lingxi /path/to/vault/.obsidian/plugins/lingxi
   ```

2. 启动 `npm run dev`

3. 在 Obsidian 中按 `Cmd/Ctrl + R` 重载插件

4. 按 `Cmd + Option + I`（macOS）或 `Ctrl + Shift + I`（Windows）打开开发者工具

### 项目结构

```
src/
├── main.ts                    # 插件入口
├── types.ts                   # 全局类型定义 + 默认设置
├── constants.ts               # 常量
├── settings.ts                # 设置管理
├── providers/
│   ├── OpenAICompatible.ts    # OpenAI 兼容 Provider（覆盖所有模型）
│   └── ProviderRegistry.ts    # Provider 注册 & 管理
├── skills/
│   ├── SceneManager.ts        # 场景化 Skill/Rules 管理
│   └── SkillManager.ts        # 传统 Skill 管理（兼容）
├── search/
│   ├── EmbeddingService.ts    # Embedding 向量化服务
│   ├── VectorStore.ts         # 本地向量存储（JSON）
│   └── RAGManager.ts          # RAG 检索编排器
├── conversation/
│   └── ConversationManager.ts # 对话上下文管理
├── archive/
│   └── AutoArchiver.ts        # 自动归档到 Vault
└── ui/
    ├── ChatView.tsx           # Obsidian 侧边栏视图
    ├── Chat.tsx               # 聊天界面主组件
    ├── MessageBubble.tsx      # 消息气泡
    ├── InputArea.tsx          # 输入区域
    ├── ModelSelector.tsx      # 模型切换
    └── SettingsPanel.tsx      # 设置面板
```

---

## ❓ 常见问题

<details>
<summary><strong>Q: 提示「请先配置模型 API Key」？</strong></summary>

进入 **设置 → 灵犀（Lingxi）**，至少为一个模型提供商配置有效的 API Key，并在「默认模型」区域选择该提供商。
</details>

<details>
<summary><strong>Q: 流式输出不工作 / 回复卡住？</strong></summary>

1. 在设置中关闭「流式输出」，使用非流式模式试试
2. 检查网络代理设置（VPN 可能干扰）
3. 确认 API Key 有效且有剩余额度
4. 打开开发者控制台（`Cmd+Option+I`）查看错误日志
</details>

<details>
<summary><strong>Q: Skill 文件没有被加载？</strong></summary>

1. 确认文件在设置中指定的场景目录下（默认 `skills-scenes/`）
2. 文件必须是 `.md` 格式
3. 文件必须包含正确的 Frontmatter（`---` 包裹的 YAML 头部）
4. 文件必须包含 `## System Prompt` 章节
5. 打开开发者控制台查看 `[Lingxi]` 相关日志
</details>

<details>
<summary><strong>Q: 归档的笔记在哪里？</strong></summary>

匹配到 Skill 时，归档到 `场景名/output_folder` 目录（如 `自媒体/选题管理/`、`知识学习/深度反思/`）。未匹配到 Skill 时，归档到设置中的默认归档文件夹（默认 `AI笔记/`）。
</details>

<details>
<summary><strong>Q: 如何使用本地部署的大模型（Ollama 等）？</strong></summary>

在设置面板中修改任一提供商的 **Base URL** 为本地服务地址（如 `http://localhost:11434/v1`），只要该服务兼容 OpenAI API 格式即可。
</details>

<details>
<summary><strong>Q: Remotely Save 同步失败？</strong></summary>

1. 检查 COS 的 SecretId / SecretKey 是否正确
2. 确认存储桶名称是否包含 APPID 后缀（完整名称）
3. 确认 S3 Endpoint 格式为 `cos.{地域}.myqcloud.com`
4. 检查腾讯云账号是否欠费
5. 点击 Remotely Save 的「Check」按钮重新测试连接
</details>

<details>
<summary><strong>Q: 多端同步后插件设置丢失？</strong></summary>

灵犀插件设置存储在 `.obsidian/plugins/lingxi/data.json` 中。确保 Remotely Save 没有排除 `.obsidian` 目录。同步完成后重启 Obsidian 即可加载新设置。
</details>

---

## 🙏 致谢

- [Obsidian](https://obsidian.md/) — 强大的本地知识管理工具
- [Obsidian Copilot](https://github.com/logancyang/obsidian-copilot) — 灵犀的架构灵感来源
- [Remotely Save](https://github.com/remotely-save/remotely-save) — 多端同步的核心插件
- [DeepSeek](https://deepseek.com/)、[通义千问](https://tongyi.aliyun.com/)、[豆包](https://www.volcengine.com/product/doubao)、[Kimi](https://kimi.moonshot.cn/)、[智谱](https://www.zhipuai.cn/) — 国内优秀的大模型服务商

---

## 📄 许可证

[MIT License](./LICENSE)

---

<p align="center">
  如果灵犀对你有帮助，欢迎 ⭐ Star 支持！
</p>
