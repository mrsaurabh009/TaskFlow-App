# 🚀 TaskFlow Deployment Instructions

Complete guide to deploy TaskFlow application to production with MongoDB Atlas, Railway (backend), and Netlify (frontend).

## 📋 Prerequisites

- GitHub account (for repository hosting)
- MongoDB Atlas account (free tier available)
- Railway account (for backend hosting)
- Netlify account (for frontend hosting)

## 🗄️ Phase 1: MongoDB Atlas Setup (5 minutes)

### 1. Create MongoDB Atlas Account
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for a free account
3. Create organization: "TaskFlow Production"
4. Create project: "TaskFlow-Live"

### 2. Create Database Cluster
1. Click "Build Database" 
2. Select **M0 Sandbox (FREE)**
3. Choose **AWS** provider  
4. Select region closest to your users
5. Name cluster: **taskflow-production**
6. Click "Create Cluster"

### 3. Configure Network Access
1. Go to "Network Access" in sidebar
2. Click "Add IP Address"  
3. Select "Allow Access from Anywhere" (`0.0.0.0/0`)
4. Click "Confirm"

### 4. Create Database User
1. Go to "Database Access" in sidebar
2. Click "Add New Database User"
3. Username: `taskflow_admin`
4. Password: Generate secure password (save it!)
5. Database User Privileges: "Read and write to any database"
6. Click "Add User"

### 5. Get Connection String
1. Go to "Database" in sidebar
2. Click "Connect" on your cluster
3. Select "Connect your application"
4. Copy the connection string
5. Replace `<username>` and `<password>` with your credentials

**Example Connection String:**
```
mongodb+srv://taskflow_admin:YOUR_PASSWORD@taskflow-production.abc123.mongodb.net/?retryWrites=true&w=majority
```

## 🚂 Phase 2: Backend Deployment (Railway)

### 1. Prepare Repository
1. Push your code to GitHub if not already done:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - TaskFlow application"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/taskflow-fullstack.git
   git push -u origin main
   ```

### 2. Deploy to Railway
1. Go to [Railway](https://railway.app)
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your TaskFlow repository
6. Select the `backend` folder as root directory

### 3. Configure Environment Variables
In Railway dashboard, go to Variables tab and add:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://taskflow_admin:YOUR_PASSWORD@taskflow-production.abc123.mongodb.net/taskflow?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SESSION_SECRET=your-session-secret-key-change-this
API_PREFIX=/api
API_VERSION=v1
TRUST_PROXY=true
COMPRESSION_THRESHOLD=1024
HELMET_CONTENT_SECURITY_POLICY=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
DEBUG_MODE=false
PRETTY_PRINT_JSON=false
DETAILED_ERRORS=false
HEALTH_CHECK_INTERVAL=30000
METRICS_ENABLED=true
SWAGGER_ENABLED=false
LOG_LEVEL=combined
```

### 4. Set CORS Origin (After Frontend Deployment)
```env
CORS_ORIGIN=https://your-taskflow-frontend.netlify.app
```

### 5. Deploy
1. Railway will automatically deploy your backend
2. Wait for deployment to complete
3. Note your Railway URL: `https://your-project-name.railway.app`

## 🌐 Phase 3: Frontend Deployment (Netlify)

### 1. Update Frontend Configuration
1. Edit `frontend/config/api.js`
2. Update the production baseURL to your Railway backend URL:
   ```javascript
   production: {
     baseURL: 'https://your-project-name.railway.app/api/v1',
     timeout: 15000,
     retryAttempts: 3,
     retryDelay: 2000
   }
   ```

### 2. Update Netlify Configuration
1. Edit `frontend/netlify.toml`
2. Update the redirect URLs to your Railway backend:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://your-project-name.railway.app/api/:splat"
     status = 200
     force = true
   ```

### 3. Deploy to Netlify
1. Go to [Netlify](https://netlify.com)
2. Sign in with GitHub
3. Click "New site from Git"
4. Choose your GitHub repository
5. Configure build settings:
   - **Base directory**: `frontend`
   - **Publish directory**: `frontend`
   - **Build command**: (leave empty)

### 4. Configure Custom Domain (Optional)
1. In Netlify dashboard, go to Site settings
2. Click "Change site name" 
3. Choose: `taskflow-production` or your preferred name
4. Your site will be available at: `https://taskflow-production.netlify.app`

## 🔧 Phase 4: Final Configuration

### 1. Update CORS in Railway
1. Go back to Railway dashboard
2. Update the `CORS_ORIGIN` variable with your Netlify URL:
   ```
   CORS_ORIGIN=https://taskflow-production.netlify.app
   ```
2. Redeploy if needed

### 2. Update Frontend URLs
1. In `frontend/netlify.toml`, update CSP headers with your Railway URL
2. In `frontend/config/api.js`, confirm the production baseURL is correct

## 🧪 Phase 5: Testing & Verification

### 1. Test Backend API
```bash
# Test health endpoint
curl https://your-project-name.railway.app/health

# Test create task
curl -X POST https://your-project-name.railway.app/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"text": "Test task from production API"}'

# Test get tasks  
curl https://your-project-name.railway.app/api/v1/tasks
```

### 2. Test Frontend Application
1. Open your Netlify site: `https://taskflow-production.netlify.app`
2. Test task creation, editing, deletion
3. Verify data persistence through page refreshes  
4. Check browser console for any errors
5. Test on mobile devices

### 3. Performance Testing
- Page load time should be < 3 seconds
- API response time should be < 500ms
- Test with multiple concurrent users

## 📊 Phase 6: Monitoring & Maintenance

### 1. Monitor Application Health
- **Backend**: Railway provides built-in metrics and logs
- **Frontend**: Netlify provides analytics and deployment logs
- **Database**: MongoDB Atlas provides monitoring dashboard

### 2. Monitor Logs
```bash
# Check Railway logs
railway logs

# Check Netlify function logs (if any)
netlify logs
```

### 3. Set Up Alerts
1. **MongoDB Atlas**: Set up alerts for connection issues, high usage
2. **Railway**: Monitor deployment status and errors  
3. **Netlify**: Monitor build status and form submissions

## 🎯 Production URLs

After successful deployment:

### **Live Application URLs:**
- **Frontend**: `https://taskflow-production.netlify.app`
- **Backend API**: `https://your-project-name.railway.app`
- **API Endpoints**: `https://your-project-name.railway.app/api/v1`
- **Health Check**: `https://your-project-name.railway.app/health`
- **Database**: MongoDB Atlas dashboard

## 🚨 Troubleshooting

### Common Issues:

1. **CORS Errors**
   - Check CORS_ORIGIN in Railway matches your Netlify URL exactly
   - Ensure no trailing slashes

2. **Database Connection Issues**
   - Verify MongoDB Atlas connection string is correct
   - Check network access allows all IPs (0.0.0.0/0)
   - Confirm database user has correct permissions

3. **API Errors**
   - Check Railway logs for detailed error messages
   - Verify all environment variables are set correctly
   - Test API endpoints directly with curl/Postman

4. **Frontend Issues**
   - Check browser console for JavaScript errors
   - Verify API configuration points to correct backend URL
   - Check Netlify build logs

### Quick Fixes:

```bash
# Redeploy Railway backend
git push origin main

# Redeploy Netlify frontend  
git push origin main

# Check Railway status
railway status

# Check Netlify status
netlify status
```

## 🔒 Security Checklist

- [ ] MongoDB Atlas network access configured
- [ ] Strong passwords for database users
- [ ] JWT secrets are secure and unique
- [ ] HTTPS enabled on all endpoints
- [ ] CORS properly configured
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Environment variables secured

## 🎉 Success!

Your TaskFlow application is now:
- ✅ **LIVE** on production URLs
- ✅ **SCALABLE** with MongoDB Atlas cloud database
- ✅ **SECURE** with HTTPS and proper security headers
- ✅ **PERFORMANT** with optimized queries and caching
- ✅ **MONITORED** with health checks and metrics
- ✅ **PROFESSIONAL** with production-ready configuration

**TaskFlow is now ready for users! 🚀**
