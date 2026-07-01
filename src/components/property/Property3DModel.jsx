import React, { Suspense, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, PerspectiveCamera } from '@react-three/drei';
import { motion } from 'framer-motion';
import { FiRotateCw, FiZoomIn, FiZoomOut, FiMaximize2 } from 'react-icons/fi';

// 3D Model Component
function House3DModel({ modelPath, scale = 1 }) {
  const { scene } = useGLTF(modelPath);
  
  React.useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} scale={scale} />;
}

// Loading Component
function LoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center glass-card">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-platinum-600">Loading 3D Model...</p>
      </div>
    </div>
  );
}

// Error Component
function ErrorDisplay({ onRetry }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center glass-card">
      <div className="text-center">
        <div className="text-red-500 text-4xl mb-4">⚠️</div>
        <p className="text-sapphire-700 mb-4">Failed to load 3D model</p>
        <button 
          onClick={onRetry}
          className="btn-secondary"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// Main 3D Model Card Component
export default function Property3DModel({ 
  modelPath = '/models/house2.glb',
  title = '3D Property Model',
  description = 'Interactive 3D visualization of the property',
  className = '',
  height = 'h-96'
}) {
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsRef = useRef();

  const handleError = () => {
    setError(true);
  };

  const handleRetry = () => {
    setError(false);
    // Force re-render by changing key
    window.location.reload();
  };

  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <>
      <motion.div
        className={`glass-card relative ${height} ${className} group overflow-hidden`}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start">
          <div className="glass-card px-3 py-2">
            <h3 className="font-semibold text-sapphire-800">{title}</h3>
            <p className="text-sm text-platinum-600">{description}</p>
          </div>
          
          {/* Controls */}
          <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={resetCamera}
              className="glass-card p-2 hover:bg-glass-light transition-colors duration-200"
              title="Reset View"
            >
              <FiRotateCw size={16} className="text-sapphire-700" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="glass-card p-2 hover:bg-glass-light transition-colors duration-200"
              title="Fullscreen"
            >
              <FiMaximize2 size={16} className="text-sapphire-700" />
            </button>
          </div>
        </div>

        {/* 3D Canvas */}
        <Canvas
          shadows
          camera={{ position: [5, 5, 10], fov: 50 }}
          className="w-full h-full"
          onError={handleError}
        >
          <color attach="background" args={['transparent']} />
          
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-10, -10, -10]} intensity={0.3} />

          {/* Environment */}
          <Environment preset="city" />

          {/* Controls */}
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={3}
            maxDistance={20}
            maxPolarAngle={Math.PI / 2}
            autoRotate={false}
            autoRotateSpeed={0.5}
          />

          {/* 3D Model */}
          <Suspense fallback={null}>
            {!error && (
              <House3DModel 
                modelPath={modelPath} 
                scale={1.2}
              />
            )}
          </Suspense>

          {/* Ground plane for shadows */}
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
            <planeGeometry args={[20, 20]} />
            <shadowMaterial opacity={0.2} />
          </mesh>
        </Canvas>

        {/* Loading State */}
        <Suspense fallback={<LoadingSpinner />}>
          {/* This will show loading spinner while model loads */}
        </Suspense>

        {/* Error State */}
        {error && <ErrorDisplay onRetry={handleRetry} />}

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="glass-card px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <p className="text-xs text-platinum-600 text-center">
              Click and drag to rotate • Scroll to zoom • Right-click to pan
            </p>
          </div>
        </div>
      </motion.div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={toggleFullscreen}
        >
          <div className="absolute inset-4">
            <Property3DModel
              modelPath={modelPath}
              title={title}
              description={description}
              height="h-full"
              className="!relative"
            />
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 glass-card p-3 hover:bg-glass-light transition-colors duration-200 z-10"
            >
              <FiMaximize2 size={20} className="text-white" />
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}

// Preload the model
useGLTF.preload('/models/house2.glb');
