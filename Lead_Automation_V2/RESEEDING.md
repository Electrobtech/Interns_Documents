# Database Re-seeding Guide

## Problem
When you restart Docker containers, the PostgreSQL data persists in the `pgdata` volume. The `docker-entrypoint-initdb.d` scripts only run on the **first** database initialization, so seed data doesn't reappear after container restarts.

## Solution: Automatic Seed Data Loading

The application now includes a `seed-data-init` container that automatically checks for seed data when PostgreSQL is ready. If the database is empty, it loads the seed data automatically.

### Automatic Behavior

When you run `docker-compose up -d`, the seed data is automatically loaded if:
- This is a fresh database (no users table exists)
- The database was completely reset

### Manual Re-seeding

If you need to manually re-seed the database:

#### On Windows (PowerShell):
```powershell
.\scripts\reseed-database.ps1
```

#### On Linux/Mac (Bash):
```bash
./scripts/reseed-database.sh
```

This will re-run the seed files on your existing database without destroying any data.

### Complete Database Reset

If you want to completely reset the database (destroy all data and re-seed):

1. Stop the containers:
```bash
docker-compose down
```

2. Remove the PostgreSQL volume:
```bash
docker volume rm lead_automation_v2_pgdata pgdata
```

3. Start the containers again:
```bash
docker-compose up -d
```

The seed scripts will run automatically on fresh initialization.

## Seed Data Credentials

After re-seeding, you can login with:

- **Admin User:** admin@electrobtech.com / Admin@123
- **Super Admin:** superadmin@platform.local / SuperAdmin@123

## What Gets Seeded?

The seed files include:
- Platform admin users
- Roles and permissions
- Organization (Electrobtech Innovations)
- Demo users (admin, manager, agent)
- Teams (Support, Sales)
- Communication channels
- Integrations
- Contacts and leads
- Conversations
- Marketing Hub campaigns and audiences
- Automation workflows

## Troubleshooting

### "Cannot connect to PostgreSQL"
- Ensure Docker is running
- Check that the postgres container is healthy: `docker-compose ps`
- Verify the port is correct (default: 5435)

### "Seed data already exists"
- The re-seeding script uses `ON CONFLICT DO NOTHING`, so it's safe to run multiple times
- It will only insert missing data, not overwrite existing records

### "Permission denied"
- On Linux/Mac, make the script executable: `chmod +x scripts/reseed-database.sh`
- On Windows, run PowerShell as Administrator if needed
