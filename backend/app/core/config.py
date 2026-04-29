from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str

    storage_dir: str

    slither_image: str
    mythril_image: str
    foundry_image: str
    echidna_image: str
    redis_url: str

    analyzer_timeout_seconds: int = 120

    class Config:
        env_file = ".env"


settings = Settings()