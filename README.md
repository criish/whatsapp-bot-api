# WhatsApp Bot API with Baileys

A lightweight Node.js service that connects to WhatsApp using the **Baileys** library and exposes a simple REST API via **Express**. The API can be used by other services to send WhatsApp messages and check connection status.

---

## ✨ Features

- **Automatic QR code generation** for initial login (available via `/qr` endpoint).
- **Connection status** endpoint (`/status`).
- **Send message** endpoint (`POST /send`).
- Session persistence using a single JSON file (`auth_info.json`).
- Ready for free‑tier deployment on **Render**.

---

## 🛠️ Local Development

1. **Clone the repository** (or copy the files into a folder).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file (see `.env.example`). Example:
   ```dotenv
   PORT=3000
   SESSION_FILE=./auth_info.json
   ```
4. Start the server:
   ```bash
   npm run dev   # uses nodemon for hot‑reloading
   ```
5. Open `http://localhost:3000/qr` in a browser to see the QR code. Scan it with WhatsApp.
6. Once connected, you can test sending a message:
   ```bash
   curl -X POST http://localhost:3000/send \
        -H "Content-Type: application/json" \
        -d '{"to":"1234567890@s.whatsapp.net","message":"Hello from Baileys!"}'
   ```

---

## 🚀 Deploy to Render (Free Tier)

### 1️⃣ Create a GitHub repository

Push the project to a new GitHub repo (Render pulls directly from GitHub).

### 2️⃣ Add a Render Service

- **Service Type:** **Web Service**
- **Environment:** **Node**
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Free Plan:** Select the free tier (Render provides 750 hrs/month).
- **Branch:** `main` (or your default branch).

### 3️⃣ Add Environment Variables

| Variable       | Description                              |
|----------------|------------------------------------------|
| `PORT`         | Port that Render will expose (default `3000`). |
| `SESSION_FILE` | Path to the persisted session file (`./auth_info.json`). |

You can add these in the Render dashboard under **Environment**.

### 4️⃣ Deploy

Render will automatically run `npm install` and start the service. After the first deployment, visit `https://<your‑service>.onrender.com/qr` to get the QR code and scan it with WhatsApp. The session will be saved to the repository (if you commit `auth_info.json`) **or** you can mount a persistent storage via Render's **Static Files** if you prefer not to commit credentials.

---

## 📂 Project Structure

```
├─ .env.example          # Example environment file
├─ .gitignore            # Ignored files (node_modules, auth_info.json, .env)
├─ index.js              # Main server implementation
├─ package.json          # npm dependencies / scripts
├─ README.md             # This documentation
└─ render.yaml           # Optional Render config file (if using "Deploy from Git" with a yaml)
```

---

## 🎨 Tips for Production

- **Never commit `auth_info.json`** to a public repo. Use Render's **Persistent Disk** or upload the file manually after the first QR scan.
- Enable **HTTPS** (Render provides it automatically).
- Consider rate‑limiting the `/send` endpoint if you expose it publicly.

---

## 🙋‍♂️ Need Help?

Feel free to ask for further customization, adding more endpoints (e.g., receive messages, webhook integration), or troubleshooting connection issues.
