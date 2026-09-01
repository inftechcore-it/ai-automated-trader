"""
Model Manager - Loads and manages ML models
"""
import os
import logging
from pathlib import Path
from typing import Optional, Dict
import joblib

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent.parent / "data" / "models"


class ModelManager:
    def __init__(self):
        self.models: Dict[str, any] = {}
        self.model_dir = MODEL_DIR

    async def load_models(self):
        """Load all trained models from disk"""
        self.model_dir.mkdir(parents=True, exist_ok=True)

        model_files = list(self.model_dir.glob("*.joblib"))

        if not model_files:
            logger.info("No pre-trained models found. Using rule-based predictions.")
            return

        for model_path in model_files:
            try:
                model_name = model_path.stem
                self.models[model_name] = joblib.load(model_path)
                logger.info(f"Loaded model: {model_name}")
            except Exception as e:
                logger.error(f"Failed to load model {model_path}: {e}")

        logger.info(f"Loaded {len(self.models)} models")

    def get_model(self, name: str) -> Optional[any]:
        """Get a loaded model by name"""
        return self.models.get(name)

    def save_model(self, model: any, name: str):
        """Save a trained model to disk"""
        self.model_dir.mkdir(parents=True, exist_ok=True)
        model_path = self.model_dir / f"{name}.joblib"
        joblib.dump(model, model_path)
        logger.info(f"Saved model: {name}")

    def list_models(self) -> list:
        """List all available models"""
        return list(self.models.keys())
