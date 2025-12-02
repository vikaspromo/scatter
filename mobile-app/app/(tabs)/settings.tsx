import { StyleSheet, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { Text, View } from '@/components/Themed';
import { mockStudents } from '@/data/mockData';
import { useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function SettingsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);

  return (
    <ScrollView style={styles.container}>
      {/* My Students Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Students</Text>
        <View style={styles.card}>
          {mockStudents.map((student, index) => (
            <View key={student.id}>
              <View style={styles.studentRow}>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <Text style={styles.studentDetails}>
                    {student.grade} {student.teacher ? `• ${student.teacher}` : ''}
                  </Text>
                </View>
                <TouchableOpacity>
                  <FontAwesome name="pencil" size={18} color="#666" />
                </TouchableOpacity>
              </View>
              {index < mockStudents.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
          <TouchableOpacity style={styles.addButton}>
            <FontAwesome name="plus" size={16} color="#007AFF" />
            <Text style={styles.addButtonText}>Add Student</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDescription}>
                Get reminded the night before
              </Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={pushEnabled ? '#007AFF' : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>parent@example.com</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow}>
            <Text style={[styles.settingLabel, styles.signOutText]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Scatter v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 4,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 17,
    fontWeight: '500',
  },
  studentDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginLeft: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  addButtonText: {
    fontSize: 17,
    color: '#007AFF',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingLabel: {
    fontSize: 17,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  signOutText: {
    color: '#FF3B30',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 13,
    color: '#999',
  },
});
