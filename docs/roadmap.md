# Project Roadmap

Future development plans for the Tempest Weather Suite.

## Phase 1: Foundation ✅ (Complete)

- [x] Project structure and organization
- [x] Node.js backend API server
- [x] SQLite database integration
- [x] Tempest API integration with caching
- [x] RESTful API endpoints
- [x] Google Home webhook
- [x] Minimalist React dashboard
- [x] Raspberry Pi deployment guide
- [x] Google Home integration guide
- [x] Documentation

## Phase 2: Analytics Dashboard (Next)

### Features to Implement

- [x] **History View (1.5.0)**: Wunderground-style hourly table with date picker; conditions stored in observations; BottomNav (mobile) and History link (desktop). See `docs/plans/plan-1.5.0-history-view.md`.
- [ ] React app with Chart.js
- [ ] Historical temperature trends (line charts)
- [ ] Precipitation history (bar charts)
- [ ] Wind rose diagrams
- [ ] Pressure trends
- [ ] UV index tracking
- [ ] Custom date range selection
- [ ] Data export (CSV, JSON)
- [ ] Comparison views (day over day, week over week)
- [ ] Monthly/yearly summaries
- [ ] **LLM historical data chat (1.5.0)**: In-app chat to ask questions about history (“average temp past week”), get text summaries and optional inline charts; MVP with structured commands, optional LLM later. See `docs/plans/plan-1.6.0-llm-historical-chat.md`.

### Technical Tasks

- [ ] Create analytics React app structure
- [ ] Integrate Chart.js and react-chartjs-2
- [ ] Build data aggregation services
- [ ] Implement chart components
- [ ] Add date range picker
- [ ] Create export functionality
- [ ] Design responsive layout
- [ ] Add print stylesheet for reports

## Phase 3: Enhanced Features

### Deprecated (2026-02-07)
- ~~Condition-based ambient overlays~~ (data-condition gradients from atmosphere) — Deprecated; related plans removed.

### Weather Alerts

- [x] **NWS storm/warning label (1.3.9)**: Winter Storm Warning and other NWS alerts as a pill after the menu icon; tap for full text. See `docs/plans/archive/plan-1.3.9-storm-warning.md`.
- [ ] Configurable threshold alerts
- [ ] Push notifications
- [ ] Email notifications
- [ ] SMS alerts (via Twilio)
- [ ] Lightning strike alerts
- [ ] Extreme weather warnings
- [ ] Custom alert rules

### Advanced Visualizations

- [ ] **Radar preview tile (1.6.0)**: Conditional tile (first in metrics list) when conditions indicate precip; radar imagery as background via RainViewer or NOAA. See `docs/plans/plan-1.5.0-radar-tile.md`.
- [ ] Heat maps for temperature over time
- [ ] Animated weather maps
- [ ] Full radar map (future): Multi-station map with inline metrics, radar overlay.
- [ ] Satellite imagery overlay
- [ ] Lightning strike mapping
- [ ] Storm tracking

### Multi-Station Support

- [ ] Support multiple Tempest stations
- [ ] Station selection interface
- [ ] Comparison between stations
- [ ] Network of stations dashboard
- [ ] Aggregate statistics

## Phase 4: Mobile & Progressive Web App

### Mobile Experience

- [ ] Responsive design improvements
- [ ] Touch-optimized interface
- [ ] Swipe gestures
- [ ] Mobile-specific layouts
- [ ] Offline support
- [ ] Add to home screen prompt

### PWA Features

- [ ] Service worker for offline caching
- [ ] App manifest
- [ ] Push notification support
- [ ] Background sync
- [ ] Install prompts

## Phase 5: Advanced Integration

### Third-Party Integrations

- [ ] Home Assistant integration
- [ ] IFTTT webhooks
- [ ] Zapier integration
- [ ] Amazon Alexa skill
- [ ] Apple HomeKit via Homebridge
- [ ] Weather Underground upload
- [ ] CWOP (Citizen Weather Observer Program)

### API Enhancements

- [ ] API key authentication
- [ ] Rate limiting per API key
- [ ] WebSocket for real-time updates
- [ ] GraphQL endpoint
- [ ] Bulk data export API
- [ ] Weather station sharing API

## Phase 6: AI & Machine Learning

### Natural-language data access

- [ ] **Historical data chat (1.5.0)**: Ask questions in plain language, get analysis and charts from Tempest historical DB. MVP: structured commands; upgrade: LLM with tools. See `docs/plans/plan-1.6.0-llm-historical-chat.md`.

### Predictive Features

- [ ] Local weather prediction models
- [ ] Anomaly detection
- [ ] Pattern recognition
- [ ] Frost prediction
- [ ] Best time for outdoor activities
- [ ] Energy usage predictions based on weather

### Smart Suggestions

- [ ] Watering recommendations for gardens
- [ ] HVAC optimization suggestions
- [ ] Solar panel efficiency predictions
- [ ] Outfit recommendations

## Phase 7: Community Features

### Social & Sharing

- [ ] Weather station profiles
- [ ] Public dashboard sharing
- [ ] Social media integration
- [ ] Weather photography gallery
- [ ] Community weather network
- [ ] Leaderboards (extremes, records)

### Collaboration

- [ ] Open API for developers
- [ ] Plugin system
- [ ] Custom widgets
- [ ] Theme marketplace
- [ ] Community contributions

## Infrastructure Improvements

### Performance

- [ ] Redis caching layer
- [ ] CDN for static assets
- [ ] Database optimization
- [ ] Query optimization
- [ ] Lazy loading
- [ ] Code splitting

### DevOps

- [ ] Docker containerization
- [ ] Docker Compose for development
- [ ] Kubernetes deployment
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Automated testing
- [ ] Load testing
- [ ] Monitoring and logging (Grafana, Prometheus)

### Security

- [ ] HTTPS everywhere
- [ ] API authentication
- [ ] Rate limiting
- [ ] Input validation
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF tokens
- [ ] Security headers
- [ ] Regular security audits

## Documentation Enhancements

- [ ] Video tutorials
- [ ] Interactive API explorer
- [ ] Architecture diagrams
- [ ] Component documentation
- [ ] Code examples library
- [ ] FAQ section
- [ ] Troubleshooting flowcharts
- [ ] Migration guides

## Testing & Quality

- [ ] Unit tests (Jest)
- [ ] Integration tests
- [ ] End-to-end tests (Playwright)
- [ ] API tests
- [ ] Performance tests
- [ ] Accessibility tests
- [ ] Cross-browser testing
- [ ] Mobile device testing

## Timeline

### Q1 2024
- Complete Phase 2 (Analytics Dashboard)
- Begin Phase 3 (Enhanced Features)

### Q2 2024
- Complete Phase 3
- Begin Phase 4 (Mobile & PWA)

### Q3 2024
- Complete Phase 4
- Begin Phase 5 (Advanced Integration)

### Q4 2024
- Complete Phase 5
- Begin Phase 6 (AI & ML)

### 2025
- Phases 6-7
- Infrastructure improvements
- Community building

## Contributing

We welcome contributions! Priority areas:

1. Analytics dashboard development
2. Chart components and visualizations
3. Documentation improvements
4. Testing coverage
5. Mobile optimizations
6. Third-party integrations

## Feedback & Suggestions

Have ideas for features? Open an issue or submit a pull request!

---

*This roadmap is subject to change based on user feedback, priorities, and available resources.*
