import React, { useState, useEffect } from 'react';
import { getBingImages } from '../services/api';

const Background: React.FC = () => {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    getBingImages().then((res) => {
      if (res.status && res.data.length > 0) {
        setImages(res.data.map(img => img.url));
      }
    });
  }, []);

  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images]);

  if (images.length === 0) {
    return <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 to-blue-100 -z-10" />;
  }

  return (
    <>
      {images.map((url, index) => (
        <div
          key={url}
          className={`fixed inset-0 w-full h-full bg-cover bg-center -z-10 transition-opacity duration-1000 ease-in-out ${
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backgroundImage: `url(${url})` }}
        />
      ))}
    </>
  );
};

export default Background;
