FROM python:3.12-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y \
    curl git build-essential jq ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir slither-analyzer solc-select

RUN solc-select install 0.8.20
RUN solc-select use 0.8.20

CMD ["bash"]
