# Codex Switcher Pro

一个简洁的桌面应用程序，用于管理 Codex 的模型提供商和模型配置。

## 功能

- **多提供商管理** - 配置和管理多个 AI API 提供商
- **模型切换** - 一键切换提供商和模型
- **全局模型列表** - 所有提供商共享统一的模型库
- **独立模型选择** - 每个提供商记住自己的当前模型
- **Claude Code 配置** - 快速配置 Claude Code 环境变量
- **极简界面** - 黑白配色，简洁直观

## 安装

### 从源码运行

```bash
git clone https://github.com/ymkiux/codexmate.git
cd codex-switcher-pro
npm install
npm start
```

### 下载发布版本

从 [Releases](https://github.com/ymkiux/codexmate/releases) 下载最新的 Windows 可执行文件。

## 使用

### Codex 模式

1. 添加提供商：填写名称、API 端点和密钥
2. 切换提供商：点击提供商列表中的项目
3. 管理模型：添加或删除全局模型列表中的模型

### Claude Code 模式

1. 配置 API Key（自动同步到 `ANTHROPIC_API_KEY` 和 `ANTHROPIC_AUTH_TOKEN`）
2. 设置 Base URL 和模型
3. 应用到系统环境变量

## 配置文件

配置存储在 `~/.codex/` 目录：

```
~/.codex/
├── config.toml                    # Codex 配置
├── auth.json                      # API 认证
├── models.json                    # 全局模型列表
└── provider-current-models.json   # 提供商当前模型
```

## 开发

```bash
npm install          # 安装依赖
npm start            # 启动应用
npm run build-nw     # 构建可执行文件
```

## 技术栈

- Vue 3
- NW.js
- Node.js
- @iarna/toml

## 许可证

MIT License
