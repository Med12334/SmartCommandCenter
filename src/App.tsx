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
  const [modalVisible, setModalVisible] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newTriggerEntity, setNewTriggerEntity] = useState('binary_sensor.hall_motion');
  const [newActionEntity, setNewActionEntity] = useState('switch.coffee_maker');

  const storageRef = useRef<LocalStorageEngine>(new LocalStorageEngine());
  const ruleEngineRef = useRef<RuleEngine | null>(null);

  useEffect(() => {
    storageRef.current.init().catch(() => {});

    const engine = new RuleEngine((action) => {
      const logMsg = `⚡ [AST TRIGGER]: ${action.service.toUpperCase()} -> ${action.targetEntityId}`;
      setLogs((prev) => [logMsg, ...prev.slice(0, 6)]);

      setDevices((prev) =>
        prev.map((d) =>
          d.entityId === action.targetEntityId
            ? { ...d, state: 'on', lastUpdated: Date.now() }
            : d
        )
      );
    });

    engine.registerRules(rules);
    INITIAL_DEVICES.forEach((d) => engine.ingestStateUpdate(d));
    ruleEngineRef.current = engine;
  }, []);

  const toggleDevice = (entityId: string) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.entityId === entityId) {
          const nextState = d.state === 'on' ? 'off' : 'on';
          const updated: DeviceState = { ...d, state: nextState, lastUpdated: Date.now() };

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
    ruleEngineRef.current?.registerRules(updatedRules);
    setLogs((prev) => [`✨ [RULE REGISTERED]: ${newRuleName}`, ...prev.slice(0, 6)]);

    setNewRuleName('');
    setModalVisible(false);
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

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Active Automations ({rules.length})</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.addBtnText}>+ Add Rule</Text>
          </TouchableOpacity>
        </View>

        {rules.map((rule) => (
          <View key={rule.id} style={styles.ruleCard}>
            <Text style={styles.ruleName}>{rule.name}</Text>
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

      {/* Modal for Rule Creation */}
      <Modal visible={modalVisible} transparent animationType="fade">
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
                onPress={() => setModalVisible(false)}
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
  ruleCard: {
    backgroundColor: '#131b2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  ruleName: { color: '#f8fafc', fontSize: 14, fontWeight: '700', marginBottom: 4 },
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
