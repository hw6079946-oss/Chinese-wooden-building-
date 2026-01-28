import React from 'react';
import { Box } from '@react-three/drei';
import '../types';

export const WorkshopTable: React.FC = () => {
  const tableWidth = 12;
  const tableDepth = 8;
  const tableHeight = 0.5; // Thickness of the top
  const legHeight = 4;
  const legRadius = 0.3;

  return (
    <group position={[0, -0.01, 0]}>
      {/* Table Top (Butcher Block Style) */}
      <Box 
        args={[tableWidth, tableHeight, tableDepth]} 
        position={[0, -tableHeight / 2, 0]} 
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#8B5A2B" roughness={0.7} map={null} />
      </Box>

      {/* Legs */}
      <TableLeg x={-tableWidth/2 + 1} z={-tableDepth/2 + 1} height={legHeight} radius={legRadius} />
      <TableLeg x={tableWidth/2 - 1} z={-tableDepth/2 + 1} height={legHeight} radius={legRadius} />
      <TableLeg x={-tableWidth/2 + 1} z={tableDepth/2 - 1} height={legHeight} radius={legRadius} />
      <TableLeg x={tableWidth/2 - 1} z={tableDepth/2 - 1} height={legHeight} radius={legRadius} />

      {/* Grid Lines helper (faded on top) */}
      <gridHelper position={[0, 0.01, 0]} args={[10, 10, 0x000000, 0x555555]} rotation={[0,0,0]} >
        <meshBasicMaterial transparent opacity={0.1} color="#000" />
      </gridHelper>
    </group>
  );
};

const TableLeg: React.FC<{x: number, z: number, height: number, radius: number}> = ({x, z, height, radius}) => {
    return (
        <mesh position={[x, -height/2 - 0.5, z]} castShadow receiveShadow>
            <boxGeometry args={[radius * 2, height, radius * 2]} />
            <meshStandardMaterial color="#5D4037" roughness={0.8} />
        </mesh>
    );
}
