# Service Template

Copy this folder to create a new microservice (e.g. campaign-service).

1. `cp -r services/_template services/campaign-service`
2. Rename in package.json and set a unique port.
3. Implement routes in src/index.js (reuse `authenticate` from @lead/shared).
4. Register the path in `api-gateway/src/index.js` route table.
5. Add a block in `docker-compose.yml` and a Dockerfile.
