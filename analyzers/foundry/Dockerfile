FROM python:3.12-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y \
    curl git build-essential jq ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir solc-select

RUN solc-select install 0.8.20
RUN solc-select use 0.8.20

RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="/root/.foundry/bin:${PATH}"
RUN /root/.foundry/bin/foundryup

RUN mkdir -p /opt/foundry-libs \
    && cd /opt/foundry-libs \
    && git clone --depth 1 https://github.com/foundry-rs/forge-std.git

CMD ["bash"]
