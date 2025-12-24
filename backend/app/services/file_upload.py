import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import HTTPException, UploadFile
from PIL import Image

from app.config import settings


class FileUploadService:
    """Service for handling file uploads, specifically images"""

    def __init__(self):
        self.upload_dir = Path(settings.upload_dir)
        self.max_file_size = settings.max_file_size
        self.allowed_extensions = settings.allowed_extensions
        self._ensure_upload_dir()

    def _ensure_upload_dir(self):
        """Create upload directory if it doesn't exist"""
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def _get_file_extension(self, filename: str) -> str:
        """Extract file extension from filename"""
        if "." not in filename:
            return ""
        return filename.rsplit(".", 1)[1].lower()

    def _validate_extension(self, filename: str) -> bool:
        """Check if file extension is allowed"""
        ext = self._get_file_extension(filename)
        return ext in self.allowed_extensions

    def _generate_unique_filename(self, original_filename: str) -> str:
        """Generate a unique filename while preserving the extension"""
        ext = self._get_file_extension(original_filename)
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_id = uuid.uuid4().hex[:8]
        return f"{timestamp}_{unique_id}.{ext}"

    async def _validate_file_size(self, file: UploadFile) -> int:
        """Validate file size and return the size"""
        # Read file content to check size
        content = await file.read()
        size = len(content)

        if size > self.max_file_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {self.max_file_size / (1024 * 1024):.1f}MB",
            )

        # Reset file position for later reading
        await file.seek(0)
        return size

    def _validate_image(self, file_path: Path) -> bool:
        """Validate that the file is a valid image"""
        try:
            with Image.open(file_path) as img:
                img.verify()
            return True
        except Exception:
            return False

    def _optimize_image(self, file_path: Path, max_width: int = 1200) -> None:
        """Optimize image by resizing if too large and compressing"""
        try:
            with Image.open(file_path) as img:
                # Convert to RGB if necessary (for PNG with transparency)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")

                # Resize if too wide
                if img.width > max_width:
                    ratio = max_width / img.width
                    new_height = int(img.height * ratio)
                    img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

                # Save with optimization
                img.save(file_path, quality=85, optimize=True)
        except Exception:
            # If optimization fails, keep the original
            pass

    async def upload_image(
        self, file: UploadFile, optimize: bool = True
    ) -> Optional[str]:
        """
        Upload and process an image file

        Args:
            file: The uploaded file
            optimize: Whether to optimize the image

        Returns:
            The relative URL path to the uploaded image
        """
        if not file or not file.filename:
            return None

        # Validate extension
        if not self._validate_extension(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed. Allowed types: {', '.join(self.allowed_extensions)}",
            )

        # Validate file size
        await self._validate_file_size(file)

        # Generate unique filename
        unique_filename = self._generate_unique_filename(file.filename)
        file_path = self.upload_dir / unique_filename

        # Save file
        try:
            content = await file.read()
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(content)
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to save file: {str(e)}"
            )

        # Validate it's a real image
        if not self._validate_image(file_path):
            # Remove invalid file
            os.remove(file_path)
            raise HTTPException(
                status_code=400,
                detail="Invalid image file. Please upload a valid image.",
            )

        # Optimize image if requested
        if optimize:
            self._optimize_image(file_path)

        # Return relative URL path
        return f"/uploads/{unique_filename}"

    def delete_image(self, image_url: str) -> bool:
        """
        Delete an image file

        Args:
            image_url: The URL path of the image (e.g., /uploads/filename.jpg)

        Returns:
            True if deleted successfully, False otherwise
        """
        if not image_url:
            return False

        try:
            # Extract filename from URL
            filename = image_url.split("/")[-1]
            file_path = self.upload_dir / filename

            if file_path.exists():
                os.remove(file_path)
                return True
            return False
        except Exception:
            return False

    def get_image_path(self, image_url: str) -> Optional[Path]:
        """
        Get the full file path for an image URL

        Args:
            image_url: The URL path of the image

        Returns:
            The full file path or None if not found
        """
        if not image_url:
            return None

        try:
            filename = image_url.split("/")[-1]
            file_path = self.upload_dir / filename

            if file_path.exists():
                return file_path
            return None
        except Exception:
            return None


# Singleton instance
file_upload_service = FileUploadService()
