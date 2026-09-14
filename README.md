# NaviSea — IoT Realtime Marine Border Alert System

## Stack
- **Frontend**: React 18 + Vite, React Router, Axios, React-Leaflet
- **Backend**: PHP 8 REST API
- **Database**: MySQL (via XAMPP)

## Project Structure
```
navicap/
├── frontend/               # React 18 app
│   └── src/
│       ├── pages/          # Dashboard, MapView, Alerts, Vessels, Settings
│       ├── components/     # Layout, StatCard
│       └── services/api.js # Axios API calls
└── backend/
    ├── api/
    │   ├── alerts.php      # GET/POST alerts, acknowledge
    │   ├── vessels.php     # GET/POST vessels
    │   └── sensor.php      # IoT device data ingestion
    ├── config/
    │   ├── db.php          # MySQL connection
    │   └── cors.php        # CORS headers
    └── db/schema.sql       # Database schema + seed data
```

## Setup

### 1. Database
```bash
mysql -u root -p < backend/db/schema.sql
```

### 2. Backend
- Ensure XAMPP Apache + MySQL are running
- Access via `http://localhost/navicap/backend/api/`

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
App runs at `http://localhost:5173`

## IoT Device Integration
POST sensor data to `/backend/api/sensor.php`:
```json
{
  "api_key": "navisea_iot_key_001",
  "vessel_id": 1,
  "latitude": 9.85,
  "longitude": 80.1,
  "speed": 6.5,
  "heading": 270,
  "temperature": 28.5,
  "battery_level": 87.2
}
```
