<p align="center">
  <!-- <img src="[LINK_TO_LOGO]" width="150" alt="Project Logo"> -->
  <h1 align="center">Multi-Model LLM Chat</h1>
</p>

<p align="center">
  <strong>Your Mission Control for Large Language Models.</strong>
  <br />
  The ultimate open-source playground for prompt engineers, developers, and AI enthusiasts to command, compare, and create with the world's top AIs in one unified interface.
</p>

<p align="center">
  <a href="https://github.com/tomar-mohit/multi-model-llm-chat/blob/main/LICENSE"><img src="https://img.shields.io/github/license/tomar-mohit/multi-model-llm-chat?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/tomar-mohit/multi-model-llm-chat/stargazers"><img src="https://img.shields.io/github/stars/tomar-mohit/multi-model-llm-chat?style=for-the-badge" alt="Stars"></a>
  <a href="https://github.com/tomar-mohit/multi-model-llm-chat/issues"><img src="https://img.shields.io/github/issues/tomar-mohit/multi-model-llm-chat?style=for-the-badge" alt="Issues"></a>
  <!-- <a href="#"><img src="https://img.shields.io/github/actions/workflow/status/tomar-mohit/multi-model-llm-chat/node.js.yml?branch=main&style=for-the-badge" alt="Build Status"></a> -->
</p>

<br>

### Why Multi-Model Chat?

> Born from the frustration of endlessly switching browser tabs, this tool was built to create a fluid, powerful, and efficient workflow. It transforms the chaotic process of multi-model testing into a streamlined command center, giving you the control to find the best AI for your task, faster than ever before.

---

## ✨ Unlock a Supercharged Workflow

This isn't just another chat app. It's a suite of precision tools designed for a professional workflow.

### ⚡️ Side-by-Side, Real-time Comparison
> No more guesswork. See how models interpret your prompts instantly.

Responses stream in real-time into clean, parallel columns, allowing for immediate evaluation of tone, accuracy, and style.

*   ✅ **Compare:** Instantly benchmark responses from **Gemini, GPT, Claude, Deepseek, Grok**, and more.
*   ✅ **Control:** Dynamically toggle any model on or off for any query with a single click.
*   ✅ **Witness:** Watch responses generate token-by-token. No more waiting for the full output.

<!-- GIF to be added: A simple screen recording of you enabling 3 models, typing "Write a poem about a robot learning to code", and showing the three poems streaming in. -->
<p align="center">
  <em>
    <p align="center">
      <img src="https://github.com/tomar-mohit/multi-model-llm-chat/blob/main/screenshots/BasicConco.gif" alt="Multi-Model LLM Chat Demo" width="800"/>
    </p>
  </em>
</p>

### 🧠 Stateful, Per-Model Conversations
> Every AI gets its own private memory.

Each model maintains its own independent conversation history. Have a deep, contextual discussion with Claude about philosophy without it affecting your technical coding session with GPT.

*   ✅ **Isolate Context:** The "Chat" toggle for each model ensures conversation history is only sent to that specific AI.
*   ✅ **Go Stateless:** Uncheck "Chat" to send history-free prompts for pure input/output testing.
*   ✅ **Manage:** Each model has its own dedicated history panel and clear button.

<!-- GIF to be added: Show a long conversation history in the Gemini column. Scroll it. Then, type a new prompt and show that only Gemini's response is a follow-up, while the others give fresh answers. -->
<p align="center">
  <em>
    <p align="center">
      <img src="https://github.com/tomar-mohit/multi-model-llm-chat/blob/main/screenshots/StatefulConvo.gif" alt="Multi-Model LLM Chat Demo" width="800"/>
    </p>
  </em>
</p>

### 🛠️ Total Conversation Control
> Don't just chat—curate. Shape the context sent back to the model.

This UI gives you the power to surgically edit and reshape the conversation history, refining the model's focus for its next response.

*   ✅ **Prune:** Remove a bad model response or an irrelevant user prompt from the history to prevent it from influencing future turns.
*   ✅ **Re-order:** Simply click a message to select it, then click another to move it, restructuring the conversational flow on the fly.

<!-- GIF to be added: A two-part GIF. First, show clicking the 'x' button on a message in the history list, and it disappears. Second, show clicking one message, then another, and watch it re-order in the list. -->
<p align="center">
  <em>
    <p align="center">
      <img src="https://github.com/tomar-mohit/multi-model-llm-chat/blob/main/screenshots/DeleteAndShift.gif" alt="Multi-Model LLM Chat Demo" width="800"/>
    </p>
  </em>
</p>

### 🎯 Advanced Prompting with Model-Specific Directives
> Command each model individually, all within a single prompt.

Embed targeted instructions for specific models directly within your query. Tell one model its persona and another its output format, all in one submission.

*   ✅ **Precision Syntax:** Use `@@model_id(your instruction)` to target a specific model.
*   ✅ **Example:** `Write a story about a dragon @@gpt(write it in the style of Shakespeare) @@claude(make it a children's story)`.
*   ✅ **Unmatched Flexibility:** The ultimate tool for complex, multi-faceted prompt engineering.

<!-- GIF to be added: Show yourself typing the exact example prompt from above. Hit submit and watch GPT produce Shakespearean text while Claude produces a simple story. This will blow people away. -->
<p align="center">
  <em>
    <p align="center">
      <img src="https://github.com/tomar-mohit/multi-model-llm-chat/blob/main/screenshots/ModelSpecificDirective.gif" alt="Multi-Model LLM Chat Demo" width="800"/>
    </p>
  </em>
</p>




### 🏭 Industrial-Grade Batch Processing (`/bulk`)
> Move from single prompts to large-scale, asynchronous testing with a dedicated job management dashboard.

The `/bulk` page is designed for serious, high-volume prompt testing, allowing you to run entire datasets against multiple models and track them as asynchronous jobs.

*   ✅ **Flexible Input Methods:** Process prompts your way. Paste a list of prompts directly into the text area, or upload a pre-formatted `.jsonl`, `.json`, `.csv`, or `.txt` file.
*   ✅ **Asynchronous Job Dashboard:** Submissions are treated as long-running jobs. Get an instant Job ID and use the dashboard to poll for status (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`) and fetch results when they're ready.
*   ✅ **Built-in Batch File Generator:** Never format a `.jsonl` file by hand again! Paste your prompts, click the `(TDFF)` button, and instantly download perfectly formatted batch files compliant with native OpenAI and Gemini APIs.
*   ✅ **Usage & Cost Tracking:** Monitor performance with detailed token usage statistics displayed for each completed job.

<!-- 
**GIF to be added:** A GIF showing the /bulk page workflow.
-->
<p align="center">
  <em>
    <p align="center">
      <img src="https://github.com/tomar-mohit/multi-model-llm-chat/blob/main/screenshots/BulkChat.gif" alt="Multi-Model LLM Chat Demo" width="800"/>
    </p>
    <p align="center">
      <img src="https://github.com/tomar-mohit/multi-model-llm-chat/blob/main/screenshots/BulkChat2.gif" alt="Multi-Model LLM Chat Demo" width="800"/>
    </p>
    <p align="center">
      <img src="https://github.com/tomar-mohit/multi-model-llm-chat/blob/main/screenshots/BulkFileProcessingGemini.gif" alt="Multi-Model LLM Chat Demo" width="800"/>
    </p>
    <p align="center">
      <img src="https://github.com/tomar-mohit/multi-model-llm-chat/blob/main/screenshots/BulkFileProcessingGPT.gif" alt="Multi-Model LLM Chat Demo" width="800"/>
    </p>
  </em>
</p>

---

## 🚀 Getting Started

Launch your own local instance in under 5 minutes.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/tomar-mohit/multi-model-llm-chat.git
    cd multi-model-llm-chat
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure API Keys**
    Create a `.env` file by copying the example:
    ```bash
    cp .env.example .env
    ```
    Now, open `.env` and add your secret keys.
    ```env
    # .env - NEVER commit this file!
    OPENAI_API_KEY="sk-..."
    ANTHROPIC_API_KEY="sk-..."
    GOOGLE_API_KEY="..."
    # Add any other keys required by the backend
    ```

4.  **Run the App**
    ```bash
    npm start
    ```

5.  **Launch!**
    *   Interactive Chat: `http://localhost:3003`
    *   Batch Processing: `http://localhost:3003/bulk`

---

## 🛠️ Tech Stack

*   **Frontend:** Plain HTML, CSS, and vanilla JavaScript (ES6+)
*   **Backend:** Node.js with Express
*   **Real-time:** Server-Sent Events (SSE) for streaming chat responses

---

## 🤝 How to Contribute

We love contributions! Whether it's a bug fix, a new feature, or documentation improvements, we welcome your help.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

Please read `CONTRIBUTING.md` for our code of conduct and more details.

## 📄 License

This project is licensed under the AGPL(v3) License. See the [LICENSE](LICENSE) file for details.
