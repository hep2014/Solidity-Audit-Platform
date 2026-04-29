FROM python:3.10-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    jq \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir mythril py-solc-x

RUN curl -L -o /usr/local/bin/solc https://github.com/ethereum/solidity/releases/download/v0.8.20/solc-static-linux \
    && chmod +x /usr/local/bin/solc

RUN mkdir -p /root/.solcx \
    && cp /usr/local/bin/solc /root/.solcx/solc-v0.8.20 \
    && chmod +x /root/.solcx/solc-v0.8.20

CMD ["bash"]
