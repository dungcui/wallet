- **Deposit:** The service will listen from network for funding events from users to exchange, then create a balance hash to push to message queue. All messages follow the same format regardless to the currencies.
- **Withdrawal:** The service will create a unsigned transaction file, which need to be signed by a sign tool. The signed file will be broadcasted by the service too after that.
- **Settlement:** For some currencies, like Ethereum, the crypto assets from funding need to transfer to one address for withdrawal, the service provides ability to bundle these transactions for signing as the same as Withdrawal.

## Requirements

1. Install Docker CE

2. Install Node (for development)

3. Prepare docker-compose.yml

## Local development

1. Run database and message queue

   ```shell
   docker-compose up -d db
   ```

2. Build wallet service app

   ```shell
   docker-compose build wallet
   ```
   ```shell
   docker-compose -f docker-compose-worker.yml build wallet
   ```

3. Run database migrations

   ```shell
   docker-compose run --rm wallet yarn knex migrate:latest
   ```
   create migrations file :
   
   yarn knex migrate:make filenames



4. Run service

   ```shell
   docker-compose -f docker-compose-worker.yml run --service-ports --rm wallet
   ```

   ```shell
   docker-compose run --service-ports --rm wallet
   ```

## Certificate

Certs is required for production only, when we set `NODE_ENV=production`

- Generate certs, and store them in folder `root > certs`

  ```shell
  yarn run gen-certs <domain>
  ```

The generated certs will be stored in `/certs`, and will be mounted into container when running.

## Testing

- Use host machine

  ```shell
  yarn install
  yarn test
  ```

- OR use container

  ```shell
  docker-compose build wallet && docker-compose run --rm wallet yarn test
  ```
