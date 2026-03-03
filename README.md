# WalkInMyShoes 👟
### AI-Powered Accessibility Empathy Training Platform
**AWS AI for Bharat Hackathon 2025**

> Step into the shoes of others. Experience disability. Build a more inclusive world.

🌐 **Live Demo** → https://d2d1ibzdtgm1nq.cloudfront.net

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# → Edit .env with your real keys (see below)

# 3. Run locally
npm run dev
# → Opens http://localhost:5173
```

---

## 🏗️ Project Structure

```
walkinmyshoes/
├── components/          # Frontend React components
│   ├── ARAuditor.tsx       # AR Accessibility Scanner
│   ├── AIGuide.tsx         # AI Chat Guide
│   ├── VisualImpairmentScene.tsx
│   ├── HearingLossScene.tsx
│   ├── MotorDisabilityScene.tsx
│   ├── ColorBlindnessScene.tsx
│   ├── ImpactDashboard.tsx
│   ├── Layout.tsx
│   └── Onboarding.tsx
├── services/            # Frontend services
│   ├── auth.ts             # AWS Cognito authentication
│   ├── api.ts              # API Gateway integration
│   └── gemini.ts           # AI service integration
├── backend/             # Backend source (AWS Lambda ready)
│   └── src/
│       ├── components/     # Additional scene components
│       ├── services/       # Backend services
│       │   ├── authService.js      # Amplify auth
│       │   ├── analyticsService.js # DynamoDB analytics
│       │   ├── certificateService.js # PDF certificates
│       │   ├── aiService.js        # AI integration
│       │   └── tfService.js        # TensorFlow.js AR
│       ├── hooks/          # Custom React hooks
│       │   ├── useAIGuide.js
│       │   ├── useARCamera.js
│       │   ├── useAudioEngine.js
│       │   ├── useEmpathyScore.js
│       │   └── useVRScene.js
│       ├── config/         # App configuration
│       │   ├── scenarios.json
│       │   └── assessmentQuestions.json
│       └── store/          # Zustand state management
│           └── appStore.js
├── scripts/
│   └── deploy-frontend.sh  # AWS deploy automation
├── .kiro/specs/            # Technical design documents
│   └── walkinmyshoes-aws-deployment/
│       ├── design.md
│       └── requirements.md
├── index.html
├── package.json
└── .env.example
```

---

## ☁️ AWS Architecture

```
Browser (React + Vite + A-Frame WebXR)
  │
  ├── CloudFront (CDN + HTTPS + Edge Caching)
  │     └── S3 (Static Frontend Hosting)
  │
  ├── API Gateway → Lambda → DynamoDB
  │     ├── POST /sessions    (empathy session data)
  │     ├── POST /audits      (AR audit reports)
  │     └── GET  /sessions/:id
  │
  └── Cognito (Auth via Hosted UI)
        ├── User Pool (walkinmyshoes-users)
        └── OAuth2 / Authorization Code Flow
```

---

## 📱 Features

| Feature | Status |
|---|---|
| 👁️ Visual Impairment Simulation (8 clinical profiles) | ✅ |
| 👂 Hearing Loss Simulation | ✅ |
| ♿ Motor Disability / Wheelchair Navigation | ✅ |
| 🌈 Color Blindness Simulation (A-Frame 3D) | ✅ |
| 🛰️ AR Spatial Auditor (AI vision analysis) | ✅ |
| 🤖 AI Guide Chat | ✅ |
| 📊 Impact Dashboard (Recharts) | ✅ |
| 🔐 AWS Cognito Authentication | ✅ |
| ☁️ DynamoDB Session Persistence | ✅ |
| 📜 Certificate Generation (PDF) | ✅ |
| 🥽 WebXR / VR Headset Support | ✅ |

---

## 🔑 Environment Variables

| Variable | Description | Where to get |
|---|---|---|
| `VITE_COGNITO_DOMAIN` | Cognito hosted UI domain | AWS Console → Cognito → App integration |
| `VITE_COGNITO_CLIENT_ID` | App client ID | AWS Console → Cognito → App clients |
| `VITE_COGNITO_USER_POOL_ID` | User pool ID | AWS Console → Cognito → User pool overview |
| `VITE_COGNITO_REGION` | AWS region | e.g. `us-east-1` |
| `VITE_API_BASE_URL` | API Gateway invoke URL | AWS Console → API Gateway → Stages |
| `VITE_CLOUDFRONT_DOMAIN` | CloudFront URL | AWS Console → CloudFront |
| `S3_BUCKET` | S3 bucket name | AWS Console → S3 |
| `CLOUDFRONT_ID` | CloudFront distribution ID | AWS Console → CloudFront |
| `DYNAMODB_LEADERBOARD_TABLE` | DynamoDB table name | AWS Console → DynamoDB |
| `DYNAMODB_PROGRESS_TABLE` | DynamoDB table name | AWS Console → DynamoDB |
| `DYNAMODB_USERS_TABLE` | DynamoDB table name | AWS Console → DynamoDB |

---

## 🚀 Deploy to AWS

```bash
# Make script executable (first time only)
chmod +x scripts/deploy-frontend.sh

# Deploy (builds + uploads to S3 + invalidates CloudFront)
./scripts/deploy-frontend.sh
```

### Manual Deploy (Windows PowerShell)
```powershell
npm run build
aws s3 sync dist/ s3://YOUR_S3_BUCKET --delete
aws cloudfront create-invalidation --distribution-id YOUR_CF_ID --paths "/*"
```

---

## 💰 AWS Cost Estimate

| Service | Est. Monthly |
|---|---|
| S3 | $1–3 |
| CloudFront | $3–8 |
| Lambda | ~free (1M requests free tier) |
| DynamoDB | ~$2–5 |
| Cognito | free tier (50,000 MAU) |
| **Total** | **~$6–16/month** |

---

## 🐛 Debug

**CloudFront invalidation status:**
```bash
aws cloudfront get-invalidation --distribution-id YOUR_ID --id INVALIDATION_ID
```

**View users in Cognito:**
AWS Console → Cognito → User Pools → walkinmyshoes-users → Users

**DynamoDB data:**
AWS Console → DynamoDB → Tables → Explore table items
