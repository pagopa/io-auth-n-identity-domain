# IO Functions LolliPOP 

## Integration test

### Testing models

To test models [@zeit/cosmosdb-server](https://www.npmjs.com/package/@zeit/cosmosdb-server) is needed, it can be installed globally by running

```bash pnpm global add @zeit/cosmosdb-server
```
It can be ran with

```bash
nohup cosmosdb-server -p 3000 &
```

Use then 
```bash
docker run -d --rm -p 10000:10000 mcr.microsoft.com/azure-storage/azurite azurite-blob --blobHost 0.0.0.0
```

Finally you can run your integration test with

```bash
COSMOSDB_URI=https://localhost:3000/ \
COSMOSDB_KEY="dummy key" \
COSMOSDB_NAME=integration-tests \
LOLLIPOP_ASSERTION_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;" \ 
pnpm test:integration:model
```

> [!WARNING]  
> Integration tests are currently **not** working. 