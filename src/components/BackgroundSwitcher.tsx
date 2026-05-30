import React, { useState, useEffect } from 'react';

export default function BackgroundSwitcher() {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    async function fetchImages() {
      try {
        const response = await fetch('/bing-images');
        if (response.ok) {
          const data: any = await response.json();
          if (data.data && Array.isArray(data.data)) {
            setImages(data.data.map((img: any) => img.url));
          }
        }
      } catch (error) {
        console.error('Failed to fetch bing images:', error);
      }
    }
    fetchImages();
  }, []);

  useEffect(() => {
    if (images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images]);

  if (images.length === 0) return null;

  return (
    <>
      {images.map((img, index) => (
        <div
          key={img}
          className={`fixed inset-0 -z-10 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backgroundImage: `url(${img})` }}
        />
      ))}
    </>
  );
}
