FROM debian:bookworm-slim

WORKDIR /workspace

ENV PATH="/root/.foundry/bin:/usr/local/bin:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        curl \
        git \
        ca-certificates \
        build-essential \
        jq \
        unzip \
        tar \
        xz-utils \
        file \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://foundry.paradigm.xyz | bash \
    && /root/.foundry/bin/foundryup \
    && test -x /root/.foundry/bin/forge \
    && ln -sf /root/.foundry/bin/forge /usr/local/bin/forge \
    && ln -sf /root/.foundry/bin/cast /usr/local/bin/cast \
    && ln -sf /root/.foundry/bin/anvil /usr/local/bin/anvil \
    && ln -sf /root/.foundry/bin/chisel /usr/local/bin/chisel \
    && /usr/local/bin/forge --version \
    && /usr/local/bin/cast --version \
    && /usr/local/bin/anvil --version

RUN rm -f /usr/local/bin/solc \
    && curl -fsSL -o /usr/local/bin/solc https://github.com/ethereum/solidity/releases/download/v0.8.20/solc-static-linux \
    && chmod +x /usr/local/bin/solc \
    && /usr/local/bin/solc --version \
    && file /usr/local/bin/solc

RUN mkdir -p /opt/foundry-libs \
    && git clone --depth 1 https://github.com/foundry-rs/forge-std.git /opt/foundry-libs/forge-std

CMD ["bash"]
