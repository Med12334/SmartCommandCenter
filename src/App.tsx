import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { DeviceState, AutomationNodeGraph } from './types/domain';
import { RuleEngine } from './engine/RuleEngine';
import { LocalStorageEngine } from './storage/Database';

const INITIAL_DEVICES: DeviceState[] = [
  {
    entityId: 'light.living_room_ceiling',
    domain: 'light',
    state: 'off',
    attributes: { friendlyName: 'Living Room Ceiling', brightness: 180 },
    lastUpdated: Date.now(),
  },
  {
    entityId: 'switch.coffee_maker',
    domain: 'switch',
    state: 'off',
    attributes: { friendlyName: 'Kitchen Coffee Bar' },
    lastUpdated: Date.now(),
  },
  {
    entityId: 'sensor.hall_illuminance',
    domain: 'sensor',
    state: '35',
    attributes: { friendlyName: 'Hallway Light Level' },
    lastUpdated: Date.now(),
  },
  {
    entityId: 'binary_sensor.hall_motion',
    domain: 'sensor',
    state: 'off',
    attributes: { friendlyName: 'Hallway Motion Sensor' },
    lastUpdated: Date.now(),
  },
];

const MOTION_RULE: AutomationNodeGraph = {
  id: 'auto_hallway_lighting',
  name: 'Motion Ambient Auto-On',
  enabled: true,
  triggers: [{ entityId: 'binary_sensor.hall_motion', toState: 'on' }],
  conditions: [
    {
      entityId: 'sensor.hall_illuminance',
      field: 'state',
      operator: 'LESS_THAN',
      targetValue: 50,
    },
  ],
  actions: [
    {
      targetEntityId: 'light.living_room_ceiling',
      service: 'turn_on',
      payload: { brightness: 255 },
    },
  ],
};

export default function App() {
  const [devices, setDevices] = useState<DeviceState[]>(INITIAL_DEVICES);
  const [logs, setLogs] = useState<string[]>(['System initialized. AST Engine ready.']);
  const storageRef = useRef<LocalStorageEngine>(new LocalStorageEngine());
  const ruleEngineRef = useRef<RuleEngine | null>(null);

  useEffect(() => {
    // 1. Initialize SQLite Database
    storageRef.current.init().catch(() => {});

    // 2. Initialize AST Engine with Action Dispatcher
    const engine = new RuleEngine((action) => {
      const logMsg = `⚡ [AST TRIGGER]: ${action.service.toUpperCase()} -> ${action.targetEntityId}`;
      setLogs((prev) => [logMsg, ...prev.slice(0, 5)]);

      // Mutate target device state on automation execution
      setDevices((prev) =>
        prev.map((d) =>
          d.entityId === action.targetEntityId
            ? { ...d, state: 'on', lastUpdated: Date.now() }
            : d
        )
      );
    });

    engine.registerRules([MOTION_RULE]);

    // Initial cache sync
    INITIAL_DEVICES.forEach((d) => engine.ingestStateUpdate(d));
    ruleEngineRef.current = engine;
  }, []);

  const toggleDevice = (entityId: string) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.entityId === entityId) {
          const nextState = d.state === 'on' ? 'off' : 'on';
          const updated: DeviceState = { ...d, state: nextState, lastUpdated: Date.now() };

          // Persist to SQLite
          storageRef.current.upsertDevice(updated).catch(() => {});

          // Ingest into AST Rule Engine
          ruleEngineRef.current?.ingestStateUpdate(updated);

          return updated;
        }
        return d;
      })
    );
  };

  const activeCount = devices.filter((d) => d.state === 'on').length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.subTitle}>EDGE AST ORCHESTRATION</Text>
          <Text style={styles.title}>Command Center</Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{devices.length}</Text>
            <Text style={styles.metricLabel}>TOTAL NODES</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricNumber, { color: '#22c55e' }]}>{activeCount}</Text>
            <Text style={styles.metricLabel}>ONLINE STATES</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Real-Time Device Mesh</Text>
        {devices.map((device) => {
          const isPowered = device.state === 'on';
          return (
            <TouchableOpacity
              key={device.entityId}
              activeOpacity={0.7}
              onPress={() => toggleDevice(device.entityId)}
              style={[styles.deviceCard, isPowered && styles.deviceCardActive]}
            >
              <View style={styles.deviceHeader}>
                <Text style={styles.deviceName}>{device.attributes.friendlyName}</Text>
                <View
                  style={[
                    styles.statusIndicator,
                    { backgroundColor: isPowered ? '#22c55e' : '#64748b' },
                  ]}
                />
              </View>
              <View style={styles.deviceMeta}>
                <Text style={styles.deviceDomain}>{device.entityId}</Text>
                <Text style={[styles.deviceState, isPowered && styles.deviceStateActive]}>
                  {device.state.toUpperCase()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Automation Event Bus</Text>
        <View style={styles.logContainer}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, height: '100%', minHeight: '100%', backgroundColor: '#090d16' },
  content: { padding: 20 },
  header: { marginBottom: 20 },
  subTitle: { color: '#38bdf8', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { color: '#f8fafc', fontSize: 28, fontWeight: '800', marginTop: 4 },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  metricCard: {
    flex: 1,
    backgroundColor: '#131b2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  metricNumber: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  metricLabel: { fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: '600' },
  sectionTitle: { color: '#cbd5e1', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  deviceCard: {
    backgroundColor: '#131b2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  deviceCardActive: { borderColor: '#22c55e', backgroundColor: '#112224' },
  deviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deviceName: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },
  statusIndicator: { width: 8, height: 8, borderRadius: 4 },
  deviceMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  deviceDomain: { color: '#64748b', fontSize: 11 },
  deviceState: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  deviceStateActive: { color: '#22c55e' },
  logContainer: {
    backgroundColor: '#05070c',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logText: { color: '#38bdf8', fontSize: 12, fontFamily: 'monospace', marginBottom: 6 },
});
