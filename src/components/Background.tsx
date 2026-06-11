import React, { useState, useEffect } from 'react';
import { getBingImages } from '../services/api';

const Background: React.FC = () => {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    getBingImages().then((res) => {
      if (res.status && res.data.length > 0) {
        setImages(res.data.map(img => img.url));
      }
    });
  }, []);

  useEffect(() => {
    images.forEach(url => {
      const img = new Image();
      img.onload = () => setLoadedImages(prev => new Set(prev).add(url));
      img.src = url;
    });
  }, [images]);

  const [displayedIndex, setDisplayedIndex] = useState(0);

  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images]);

  useEffect(() => {
    if (images.length > 0 && loadedImages.has(images[currentIndex])) {
      setDisplayedIndex(currentIndex);
    }
  }, [currentIndex, loadedImages, images]);

  if (images.length === 0) {
    return <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 to-blue-100 -z-10" />;
  }

  return (
    <>
      {images.map((url, index) => {
        const isLoaded = loadedImages.has(url);
        // Only show the image that is currently the valid displayedIndex
        const show = index === displayedIndex && isLoaded;
        return (
          <div
            key={url}
            className={`fixed inset-0 w-full h-full bg-cover bg-center -z-10 transition-opacity duration-1000 ease-in-out ${
              show ? 'opacity-100' : 'opacity-0'
            }`}
            style={isLoaded ? { backgroundImage: `url(${url})` } : {}}
          />
        );
      })}
    </>
  );
};

export default Background;
