import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { DeviceState } from './src/types/domain';

const INITIAL_DEVICES: DeviceState[] = [
  {
    entityId: 'light.living_room_ceiling',
    domain: 'light',
    state: 'on',
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
    state: '42 lux',
    attributes: { friendlyName: 'Hallway Light Level' },
    lastUpdated: Date.now(),
  },
  {
    entityId: 'binary_sensor.hall_motion',
    domain: 'sensor',
    state: 'clear',
    attributes: { friendlyName: 'Motion Sensor 01' },
    lastUpdated: Date.now(),
  },
];

export default function App() {
  const [devices, setDevices] = useState<DeviceState[]>(INITIAL_DEVICES);

  const toggleDevice = (entityId: string) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.entityId === entityId) {
          const newState = d.state === 'on' ? 'off' : 'on';
          return {
            ...d,
            state: newState,
            lastUpdated: Date.now(),
          };
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
          <Text style={styles.subTitle}>LOCAL MESH NETWORK</Text>
          <Text style={styles.title}>Command Center</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{devices.length}</Text>
            <Text style={styles.metricLabel}>TOTAL NODES</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricNumber, { color: '#22c55e' }]}>{activeCount}</Text>
            <Text style={styles.metricLabel}>ACTIVE STATES</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Local Subnet Devices</Text>

        {/* Device Grid */}
        {devices.map((device) => {
          const isPowered = device.state === 'on';
          const isInteractive = device.domain === 'light' || device.domain === 'switch';

          return (
            <TouchableOpacity
              key={device.entityId}
              activeOpacity={isInteractive ? 0.7 : 1}
              onPress={() => isInteractive && toggleDevice(device.entityId)}
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
                <Text style={styles.deviceDomain}>{device.domain.toUpperCase()}</Text>
                <Text style={[styles.deviceState, isPowered && styles.deviceStateActive]}>
                  {device.state.toUpperCase()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  subTitle: {
    color: '#38bdf8',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#131b2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
  },
  metricLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    letterSpacing: 1,
    fontWeight: '600',
  },
  sectionTitle: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  deviceCard: {
    backgroundColor: '#131b2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  deviceCardActive: {
    borderColor: '#22c55e',
    backgroundColor: '#112224',
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  deviceName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deviceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceDomain: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  deviceState: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  deviceStateActive: {
    color: '#22c55e',
  },
});
