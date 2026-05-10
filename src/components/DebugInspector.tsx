import React, { useEffect, useState } from 'react';
import { eventBus } from '../utils/eventBus';
import { MapTile } from '../assets/types';

export const DebugInspector: React.FC = () => {
    const [tileData, setTileData] = useState<{
        x: number;
        y: number;
        index: number;
        tile: number | MapTile;
    } | null>(null);

    useEffect(() => {
        const unsubscribe = eventBus.on("HoveredTileData", (data) => {
            setTileData(data);
        });
        return () => {
            unsubscribe();
        };
    }, []);

    if (!tileData) return null;

    const { x, y, index, tile } = tileData;

    return (
        <div style={{
            position: 'absolute',
            top: 10,
            right: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#00ff00',
            padding: '12px',
            borderRadius: '6px',
            fontFamily: 'monospace',
            zIndex: 9999,
            pointerEvents: 'none',
            fontSize: '13px',
            border: '1px solid #333',
            minWidth: '200px'
        }}>
            <div style={{ borderBottom: '1px solid #333', paddingBottom: '4px', marginBottom: '4px', fontWeight: 'bold', color: '#fff' }}>
                Tile Inspector
            </div>
            <div><strong>Grid X:</strong> {x}</div>
            <div><strong>Grid Y:</strong> {y}</div>
            <div><strong>Index:</strong> {index}</div>
            
            {tile !== undefined && typeof tile === 'object' ? (
                <div style={{ marginTop: '8px' }}>
                    <div><strong>Ground (ab):</strong> {(tile as MapTile).ab}</div>
                    <div><strong>Object (sobj):</strong> {(tile as MapTile).sobj}</div>
                    <div><strong>Collision (pass):</strong> {(tile as MapTile).pass}</div>
                </div>
            ) : (
                <div style={{ marginTop: '8px' }}>
                    <div><strong>Raw ID:</strong> {String(tile)}</div>
                </div>
            )}
        </div>
    );
};