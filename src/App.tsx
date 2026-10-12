import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  Modal,
} from 'react-native';
import { DeviceState, AutomationNodeGraph } from './types/domain';
import { RuleEngine } from './engine/RuleEngine';
import { LocalStorageEngine } from './storage/Database';
import { HomeAssistantSocket, ConnectionStatus } from './network/HomeAssistantSocket';

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

export default function App() {
  const [devices, setDevices] = useState<DeviceState[]>(INITIAL_DEVICES);
  const [rules, setRules] = useState<AutomationNodeGraph[]>([
    {
      id: 'auto_hall_lighting',
      name: 'Night Motion Lighting',
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
    },
  ]);
  const [logs, setLogs] = useState<string[]>(['System initialized. AST Engine ready.']);
  
  // Rule Modal State
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newTriggerEntity, setNewTriggerEntity] = useState('binary_sensor.hall_motion');
  const [newActionEntity, setNewActionEntity] = useState('switch.coffee_maker');

  // Gateway Modal & Socket State
  const [gatewayModalVisible, setGatewayModalVisible] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState('ws://192.168.1.100:8123/api/websocket');
  const [gatewayToken, setGatewayToken] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');

  const storageRef = useRef<LocalStorageEngine>(new LocalStorageEngine());
  const ruleEngineRef = useRef<RuleEngine | null>(null);
  const socketRef = useRef<HomeAssistantSocket | null>(null);

  useEffect(() => {
    storageRef.current.init().catch(() => {});

    const engine = new RuleEngine((action) => {
      const logMsg = `⚡ [AST TRIGGER]: ${action.service.toUpperCase()} -> ${action.targetEntityId}`;
      setLogs((prev) => [logMsg, ...prev.slice(0, 6)]);

      // Local state optimistic update
      setDevices((prev) =>
        prev.map((d) =>
          d.entityId === action.targetEntityId
            ? { ...d, state: 'on', lastUpdated: Date.now() }
            : d
        )
      );

      // Call remote gateway service if connected
      const [domain] = action.targetEntityId.split('.');
      socketRef.current?.callService(domain, action.service, action.targetEntityId, action.payload);
    });

    engine.registerRules(rules);
    INITIAL_DEVICES.forEach((d) => engine.ingestStateUpdate(d));
    ruleEngineRef.current = engine;
  }, []);

  const connectGateway = () => {
    if (!gatewayUrl.trim()) return;

    const socket = new HomeAssistantSocket(gatewayUrl, gatewayToken);

    socket.onStatus((status) => {
      setConnectionStatus(status);
      setLogs((prev) => [`🌐 [GATEWAY STATUS]: ${status}`, ...prev.slice(0, 6)]);
    });

    socket.onState((device) => {
      setDevices((prev) => {
        const exists = prev.some((d) => d.entityId === device.entityId);
        if (exists) {
          return prev.map((d) => (d.entityId === device.entityId ? device : d));
        }
        return [...prev, device];
      });

      storageRef.current.upsertDevice(device).catch(() => {});
      ruleEngineRef.current?.ingestStateUpdate(device);
      setLogs((prev) => [`🔄 [INCOMING SYNC]: ${device.entityId} -> ${device.state}`, ...prev.slice(0, 6)]);
    });

    socket.connect();
    socketRef.current = socket;
    setGatewayModalVisible(false);
  };

  const toggleDevice = (entityId: string) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.entityId === entityId) {
          const nextState = d.state === 'on' ? 'off' : 'on';
          const updated: DeviceState = { ...d, state: nextState, lastUpdated: Date.now() };

          storageRef.current.upsertDevice(updated).catch(() => {});
          ruleEngineRef.current?.ingestStateUpdate(updated);

          const [domain] = entityId.split('.');
          socketRef.current?.callService(
            domain,
            nextState === 'on' ? 'turn_on' : 'turn_off',
            entityId
          );

          return updated;
        }
        return d;
      })
    );
  };

  const adjustLux = (delta: number) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.entityId === 'sensor.hall_illuminance') {
          const nextVal = Math.max(0, Math.min(100, Number(d.state) + delta));
          const updated: DeviceState = { ...d, state: String(nextVal), lastUpdated: Date.now() };

          storageRef.current.upsertDevice(updated).catch(() => {});
          ruleEngineRef.current?.ingestStateUpdate(updated);

          return updated;
        }
        return d;
      })
    );
  };

  const handleAddRule = () => {
    if (!newRuleName.trim()) return;

    const createdRule: AutomationNodeGraph = {
      id: `custom_${Date.now()}`,
      name: newRuleName,
      enabled: true,
      triggers: [{ entityId: newTriggerEntity, toState: 'on' }],
      conditions: [],
      actions: [
        {
          targetEntityId: newActionEntity,
          service: 'turn_on',
          payload: {},
        },
      ],
    };

    const updatedRules = [...rules, createdRule];
    setRules(updatedRules);
    ruleEngineRef.current?.registerRules(updatedRules.filter((r) => r.enabled));
    setLogs((prev) => [`✨ [RULE REGISTERED]: ${newRuleName}`, ...prev.slice(0, 6)]);

    setNewRuleName('');
    setRuleModalVisible(false);
  };

  const toggleRuleEnabled = (id: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    setRules(updated);
    ruleEngineRef.current?.registerRules(updated.filter((r) => r.enabled));
  };

  const deleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    ruleEngineRef.current?.registerRules(updated.filter((r) => r.enabled));
    setLogs((prev) => [`🗑️ [RULE REMOVED]: ${id}`, ...prev.slice(0, 6)]);
  };

  const activeCount = devices.filter((d) => d.state === 'on').length;
  const currentLux = devices.find((d) => d.entityId === 'sensor.hall_illuminance')?.state || '35';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Gateway Bar */}
        <View style={styles.gatewayBar}>
          <View style={styles.gatewayInfo}>
            <View
              style={[
                styles.statusDot,
                connectionStatus === 'CONNECTED'
                  ? { backgroundColor: '#22c55e' }
                  : connectionStatus === 'CONNECTING'
                  ? { backgroundColor: '#eab308' }
                  : { backgroundColor: '#ef4444' },
              ]}
            />
            <Text style={styles.gatewayStatusText}>GATEWAY: {connectionStatus}</Text>
          </View>
          <TouchableOpacity
            style={styles.gatewayBtn}
            onPress={() => setGatewayModalVisible(true)}
          >
            <Text style={styles.gatewayBtnText}>Configure</Text>
          </TouchableOpacity>
        </View>

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

          if (device.entityId === 'sensor.hall_illuminance') {
            return (
              <View key={device.entityId} style={styles.deviceCard}>
                <View style={styles.deviceHeader}>
                  <Text style={styles.deviceName}>{device.attributes.friendlyName || device.entityId}</Text>
                  <Text style={[styles.deviceState, { color: '#38bdf8' }]}>{currentLux} LUX</Text>
                </View>
                <View style={styles.luxControlRow}>
                  <Text style={styles.deviceDomain}>{device.entityId}</Text>
                  <View style={styles.luxButtonRow}>
                    <TouchableOpacity style={styles.luxBtn} onPress={() => adjustLux(-10)}>
                      <Text style={styles.luxBtnText}>-10</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.luxBtn} onPress={() => adjustLux(10)}>
                      <Text style={styles.luxBtnText}>+10</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={device.entityId}
              activeOpacity={0.7}
              onPress={() => toggleDevice(device.entityId)}
              style={[styles.deviceCard, isPowered && styles.deviceCardActive]}
            >
              <View style={styles.deviceHeader}>
                <Text style={styles.deviceName}>{device.attributes.friendlyName || device.entityId}</Text>
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

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Active Automations ({rules.length})</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setRuleModalVisible(true)}
          >
            <Text style={styles.addBtnText}>+ Add Rule</Text>
          </TouchableOpacity>
        </View>

        {rules.map((rule) => (
          <View key={rule.id} style={[styles.ruleCard, !rule.enabled && styles.ruleCardDisabled]}>
            <View style={styles.ruleTopRow}>
              <Text style={[styles.ruleName, !rule.enabled && { color: '#64748b' }]}>{rule.name}</Text>
              <View style={styles.ruleActionsRow}>
                <TouchableOpacity
                  style={[styles.smallBadge, rule.enabled ? styles.badgeActive : styles.badgeDisabled]}
                  onPress={() => toggleRuleEnabled(rule.id)}
                >
                  <Text style={styles.badgeText}>{rule.enabled ? 'ACTIVE' : 'MUTED'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteRule(rule.id)}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.ruleDetail}>
              IF <Text style={{ color: '#38bdf8' }}>{rule.triggers[0]?.entityId}</Text> IS ON → TURN ON{' '}
              <Text style={{ color: '#22c55e' }}>{rule.actions[0]?.targetEntityId}</Text>
            </Text>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Automation Event Bus</Text>
        <View style={styles.logContainer}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log}
            </Text>
          ))}
        </View>
      </ScrollView>

      {/* Gateway Settings Modal */}
      <Modal visible={gatewayModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Home Assistant Socket</Text>

            <Text style={styles.inputLabel}>WEBSOCKET URL</Text>
            <TextInput
              style={styles.textInput}
              value={gatewayUrl}
              onChangeText={setGatewayUrl}
              placeholder="ws://192.168.1.100:8123/api/websocket"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>LONG-LIVED ACCESS TOKEN</Text>
            <TextInput
              style={styles.textInput}
              secureTextEntry
              value={gatewayToken}
              onChangeText={setGatewayToken}
              placeholder="Paste Bearer Token"
              placeholderTextColor="#64748b"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#1e293b' }]}
                onPress={() => setGatewayModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#22c55e' }]}
                onPress={connectGateway}
              >
                <Text style={[styles.modalBtnText, { color: '#090d16' }]}>Connect Stream</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rule Creator Modal */}
      <Modal visible={ruleModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New AST Automation</Text>

            <Text style={styles.inputLabel}>RULE NAME</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Motion Coffee Trigger"
              placeholderTextColor="#64748b"
              value={newRuleName}
              onChangeText={setNewRuleName}
            />

            <Text style={styles.inputLabel}>TRIGGER ENTITY (WHEN ON)</Text>
            <TextInput
              style={styles.textInput}
              value={newTriggerEntity}
              onChangeText={setNewTriggerEntity}
            />

            <Text style={styles.inputLabel}>ACTION ENTITY (TURN ON)</Text>
            <TextInput
              style={styles.textInput}
              value={newActionEntity}
              onChangeText={setNewActionEntity}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#1e293b' }]}
                onPress={() => setRuleModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#38bdf8' }]}
                onPress={handleAddRule}
              >
                <Text style={[styles.modalBtnText, { color: '#090d16' }]}>Create Rule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: '100%', backgroundColor: '#090d16' },
  content: { padding: 20, paddingBottom: 40 },
  gatewayBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#131b2e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  gatewayInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  gatewayStatusText: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  gatewayBtn: { backgroundColor: '#1e293b', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  gatewayBtnText: { color: '#38bdf8', fontSize: 11, fontWeight: '600' },
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  addBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  addBtnText: { color: '#38bdf8', fontSize: 12, fontWeight: '700' },
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
  luxControlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  luxButtonRow: { flexDirection: 'row', gap: 8 },
  luxBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  luxBtnText: { color: '#38bdf8', fontSize: 12, fontWeight: '700' },
  ruleCard: {
    backgroundColor: '#131b2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  ruleCardDisabled: { opacity: 0.5, borderColor: '#1e293b' },
  ruleTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ruleName: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  ruleActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeActive: { backgroundColor: '#166534' },
  badgeDisabled: { backgroundColor: '#334155' },
  badgeText: { color: '#f8fafc', fontSize: 10, fontWeight: '700' },
  deleteBtnText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
  ruleDetail: { color: '#94a3b8', fontSize: 12 },
  logContainer: {
    backgroundColor: '#05070c',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logText: { color: '#38bdf8', fontSize: 12, fontFamily: 'monospace', marginBottom: 6 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#131b2e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  inputLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  textInput: {
    backgroundColor: '#090d16',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    color: '#f8fafc',
    padding: 10,
    fontSize: 14,
    marginBottom: 14,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  modalBtnText: { color: '#f8fafc', fontWeight: '700', fontSize: 13 },
});
