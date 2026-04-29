FROM ghcr.io/crytic/echidna/echidna:latest

WORKDIR /workspace

USER root

RUN apt-get update && apt-get install -y \
    bash \
    curl \
    git \
    jq \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl -L -o /usr/local/bin/solc https://github.com/ethereum/solidity/releases/download/v0.8.20/solc-static-linux \
    && chmod +x /usr/local/bin/solc

CMD ["bash"]
