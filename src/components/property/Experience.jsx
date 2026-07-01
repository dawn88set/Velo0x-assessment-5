import {
  CameraControls,
  Environment,
  RenderTexture,
} from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Scene } from "./Scene";

export const getSceneByPropertyId = (propertyId) => {
  const properties = {
    1: {
      path: "/models/house1.glb",
      mainColor: "#c0ffe1",
      name: "Modern Villa with Pool",
      description: "A modern urban house with sleek design and efficient use of space, perfect for city living.",
      targetProfitability: 10.3,
      roi: 7.2,
      valuation: "425 ETH"
    },
    2: {
      path: "/models/house1.glb",
      mainColor: "#c0ffe1",
      name: "Luxury Penthouse",
      description: "Sophisticated penthouse with premium finishes and stunning city views.",
      targetProfitability: 9.8,
      roi: 6.8,
      valuation: "600 ETH"
    },
    3: {
      path: "/models/house1.glb",
      mainColor: "#c0ffe1",
      name: "Waterfront Estate",
      description: "Exclusive waterfront property with private dock and premium amenities.",
      targetProfitability: 11.5,
      roi: 7.5,
      valuation: "1050 ETH"
    },
    4: {
      path: "/models/house2.glb",
      mainColor: "#ffc0c0",
      name: "Contemporary Smart Home",
      description: "State-of-the-art smart home with energy-efficient design and modern technology.",
      targetProfitability: 12.1,
      roi: 8.1,
      valuation: "475 ETH"
    }
  };

  return properties[propertyId] || properties[1];
};

export const scenes = [
  {
    path: "/models/house1.glb",
    mainColor: "#c0ffe1",
    name: "Modern Villa with Pool",
    description: "A modern urban house with sleek design and efficient use of space, perfect for city living.",
    targetProfitability: 10.3,
    roi: 7.2,
    valuation: "425 ETH"
  },
];

const CameraHandler = () => {
  const cameraControls = useRef();

  useEffect(() => {
    const resetTimeout = setTimeout(() => {
      if (cameraControls.current) {
        cameraControls.current.setLookAt(0, 0, 5, 0, 0, 0);
      }
    }, 200);
    return () => clearTimeout(resetTimeout);
  }, []);

  return (
    <CameraControls
      ref={cameraControls}
      touches={{
        one: 0,
        two: 0,
        three: 0,
      }}
      mouseButtons={{
        left: 0,
        middle: 0,
        right: 0,
      }}
    />
  );
};

export const Experience = ({ propertyId }) => {
  const viewport = useThree((state) => state.viewport);

  const currentScene = getSceneByPropertyId(propertyId);
  const scenesToRender = [currentScene];

  return (
    <>
      <ambientLight intensity={0.2} />
      <Environment  preset="sunset"/>
      <CameraHandler />
      {scenesToRender.map((scene, index) => (
        <mesh
          key={index}
          position={[0, 0, 0]}
        >
          <planeGeometry args={[viewport.width, viewport.height]} />
          <meshBasicMaterial toneMapped={false}>
            <RenderTexture attach="map">
              <Scene {...scene} />
            </RenderTexture>
          </meshBasicMaterial>
        </mesh>
      ))}
    </>
  );
};
