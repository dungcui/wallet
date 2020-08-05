#!/bin/bash

# This script is to generate cert for specific domain
# In local please input localhost as domain
# This should be executive by yarn run gen-cert <domain>

domain=$1

# Validate domain
if [ -z $domain ]; then
  echo "Error: There is no domain name"
  echo "- Usage: yarn run gen-certs <domain>"
  echo "- Example: yarn run gen-certs localhost"
  exit 1
fi

# Check & create certs for domain name
echo "Creating folder for certs in ./certs..."
mkdir certs &> /dev/null || {
  echo "Error: Folder ./certs existed"
  exit 1
}
cd ./certs

# Start to generate
echo "Generating certificates..."

# Cert authority
openssl genrsa -passout pass:1111 -des3 -out ca.key 4096
openssl req -passin pass:1111 -new -x509 -days 3650 -key ca.key -out ca.crt -subj  "/C=CL/ST=RM/L=Santiago/O=Test/OU=Test/CN=ca"

# Server certs
openssl genrsa -passout pass:1111 -des3 -out server.key 4096
openssl req -passin pass:1111 -new -key server.key -out server.csr -subj  "/C=CL/ST=RM/L=Santiago/O=Test/OU=Server/CN=$domain"
openssl x509 -req -passin pass:1111 -days 3650 -in server.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out server.crt
openssl rsa -passin pass:1111 -in server.key -out server.key
openssl rsa -in server.key -pubout -out server.pub

# Client certs
openssl genrsa -passout pass:1111 -des3 -out client.key 4096
openssl req -passin pass:1111 -new -key client.key -out client.csr -subj  "/C=CL/ST=RM/L=Santiago/O=Test/OU=Client/CN=$domain"
openssl x509 -passin pass:1111 -req -days 3650 -in client.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out client.crt
openssl rsa -passin pass:1111 -in client.key -out client.key
