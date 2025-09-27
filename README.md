# BrewTube Backend

A scalable video platform for uploading, streaming, and sharing content, complete with built-in user interaction (likes, comments, subscriptions) and personalized content recommendations.

## 🚀 Features

- 🔄 Video Uploading & Streaming (chunked uploads, adaptive streaming)
- 👤 User Authentication & Authorization (JWT-based)
- 🗨️ Interactions: Comments, Likes, Dislikes, Subscriptions
- 🎯 Recommendation Engine (based on user behavior & trending content)
- 🔎 Video Search & Tags
- 📊 Analytics: Views, Watch Time, Engagement
- ☁️ Scalable Storage Integration (e.g., AWS S3, local FS)
- ⚙️ RESTful API built with Node.js & Express

## 🛠️ Tech Stack

- **Backend:** Node.js, Express
- **Database:** MongoDB (with Mongoose)
- **Storage:** Cloudinary
- **Authentication:** JWT


## 📦 Installation

```bash
git clone https://github.com/hmnsd/brew-tube-backend.git
cd brew-tube-backend
npm install
npm run dev
