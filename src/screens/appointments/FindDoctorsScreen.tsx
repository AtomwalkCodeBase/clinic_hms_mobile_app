import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, EmptyState, ErrorBanner } from "@/components/Layout";
import { PrimaryButton } from "@/components/Buttons";
import { Card } from "@/components/Card";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { search, getDoctors, getHospitals, getSpecialties } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { DoctorCard, Hospital, Specialty } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { getSpecialtyStyle } from "@/theme/specialtyStyle";

export function FindDoctorsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "FindDoctors">>();
  const { theme } = useAppTheme();
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState(route.params?.initialSpecialty || "");
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const initialComplaint = route.params?.initialComplaint;
  const patientAwpid = route.params?.patientAwpid;
  const patientName = route.params?.patientName;
  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const preselectedTenant = route.params?.tenantId;
  // "Browse hospitals" (the always-populated /portal/hospitals/ list) is the
  // default view — /portal/search/ deliberately returns nothing on an empty
  // query/specialty/city (avoids an unfiltered full-table scan), so falling
  // back to it here instead of a real endpoint used to just show nothing.
  const browsingHospitals = !preselectedTenant && !specialty && query.trim().length < 2;
  // A real text search (e.g. "lake") returns matching hospitals in the
  // response too — a query that only matches a hospital name and no
  // doctor's name/specialty (like "Lakeview Clinic") used to show "No
  // doctors found" even though the hospital itself was right there in
  // res.hospitals, because only res.doctors was ever read below.
  const [searchedHospitals, setSearchedHospitals] = useState<Hospital[]>([]);

  useEffect(() => {
    getSpecialties()
      .then(setSpecialties)
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (preselectedTenant) {
        const results = await getDoctors(preselectedTenant);
        setDoctors(results.map((d) => ({ ...d, hospital: route.params?.hospitalName })));
      } else if (browsingHospitals) {
        setHospitals(await getHospitals());
      } else {
        const res = await search({ q: query, specialty });
        setDoctors(res.doctors);
        setSearchedHospitals(res.hospitals);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [preselectedTenant, query, specialty, browsingHospitals, route.params]);

  // Re-runs on specialty/tenant changes immediately, and on typing with a
  // short debounce — previously `query` wasn't a dependency at all, so
  // typing "lake" did nothing until the keyboard's submit/return key was
  // pressed (onSubmitEditing), which isn't how live search is expected to
  // behave and read as "the search is broken" even though the backend and
  // the result-parsing were both already correct.
  useEffect(() => {
    const t = setTimeout(() => load(), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [query, specialty, preselectedTenant]);

  // /portal/hospitals/<id>/doctors/ always returns every doctor at that
  // hospital regardless of specialty — the search bar/specialty picker are
  // hidden in this mode, so filtering has to happen client-side here
  // instead of round-tripping to /portal/search/ (which isn't tenant-scoped).
  const visibleDoctors = preselectedTenant && specialty ? doctors.filter((d) => d.specialisation === specialty) : doctors;

  const grouped = visibleDoctors.reduce<Record<string, DoctorCard[]>>((acc, d) => {
    const key = d.hospital || "Results";
    (acc[key] = acc[key] || []).push(d);
    return acc;
  }, {});

  return (
    <Screen>
      <BackHeader title="Find doctors" onBack={() => navigation.goBack()} />

      {!!initialComplaint && (
        <View style={styles.contextBanner}>
          <Text style={styles.contextText}>Booking for: {initialComplaint}</Text>
        </View>
      )}

      {!preselectedTenant && (
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={load}
            placeholder="Doctor or hospital name"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.searchInput}
          />
        </View>
      )}
      {!!error && <ErrorBanner message={error} onRetry={load} />}

      {browsingHospitals && specialties.length > 0 && (
        <>
          <Text style={styles.gridTitle}>Most searched specialities</Text>
          <View style={styles.specGrid}>
            {specialties.slice(0, 8).map((s) => {
              const st = getSpecialtyStyle(s.name);
              const Icon = st.icon;
              return (
                <Pressable key={s.name} onPress={() => setSpecialty(s.name)} style={styles.specItem}>
                  <View style={[styles.specCircle, { backgroundColor: st.bg }]}>
                    <Icon size={20} color={st.fg} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.specLabel} numberOfLines={1}>
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {browsingHospitals ? (
        hospitals.length === 0 && !loading ? (
          <EmptyState text="No hospitals available for booking yet." />
        ) : (
          // push(), not navigate() — this screen re-targets itself at a
          // hospital by re-using its own route name. navigate() to an
          // already-mounted route just merges the new params into the
          // current stack entry instead of adding one, so there was only
          // ever one "FindDoctors" entry in the stack — pressing back from
          // a hospital's doctor list skipped past it entirely and landed on
          // whatever was underneath (Home), not the hospital list. push()
          // always adds a real new entry, so back correctly steps back
          // through each hospital drill-down one at a time.
          hospitals.map((h) => (
            <Pressable key={h.tenant_id} onPress={() => navigation.push("FindDoctors", { tenantId: h.tenant_id, hospitalName: h.name })}>
              <Card>
                <Text style={styles.docName}>{h.name}</Text>
                <Text style={styles.docSpec}>{h.city || h.state || "—"}</Text>
              </Card>
            </Pressable>
          ))
        )
      ) : !loading && doctors.length === 0 && searchedHospitals.length === 0 ? (
        <EmptyState text="No doctors or hospitals found. Try a different search." />
      ) : (
        <>
          {searchedHospitals.map((h) => (
            <Pressable key={h.tenant_id} onPress={() => navigation.push("FindDoctors", { tenantId: h.tenant_id, hospitalName: h.name })}>
              <Card>
                <Text style={styles.docName}>{h.name}</Text>
                <Text style={styles.docSpec}>{h.city || h.state || "—"}</Text>
              </Card>
            </Pressable>
          ))}
          {Object.entries(grouped).map(([hospital, docs]) => (
          <View key={hospital}>
            <Pressable
              onPress={() =>
                docs[0]?.tenant_id &&
                navigation.push("FindDoctors", { tenantId: docs[0].tenant_id, hospitalName: hospital })
              }
            >
              <Text style={[styles.hospitalHeading, { color: theme.text }]}>{hospital} →</Text>
            </Pressable>
            {docs.map((doc) => (
              <View key={doc.id} style={styles.docRow}>
                <View style={[styles.avatar, { backgroundColor: theme.bg }]}>
                  <Text style={[styles.avatarText, { color: theme.text }]}>{doc.name.replace("Dr. ", "")[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>{doc.name}</Text>
                  <Text style={styles.docSpec}>{doc.specialisation || "General"}</Text>
                  <Text style={styles.docMeta}>
                    {doc.experience_years ? `${doc.experience_years} yrs exp` : ""}
                    {doc.experience_years && doc.consultation_fee ? " · " : ""}
                    {doc.consultation_fee ? `₹${doc.consultation_fee}` : ""}
                  </Text>
                </View>
                <PrimaryButton
                  label="Book"
                  onPress={() =>
                    (doc.tenant_id || preselectedTenant) &&
                    navigation.navigate("DoctorDetail", {
                      tenantId: (doc.tenant_id || preselectedTenant)!,
                      doctorId: doc.id,
                      initialComplaint,
                      patientAwpid,
                      patientName,
                    })
                  }
                  style={styles.bookBtn}
                />
              </View>
            ))}
          </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  contextBanner: { backgroundColor: NEUTRAL.surfaceAlt, borderRadius: 10, padding: 10, marginBottom: 12 },
  contextText: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textPrimary },
  searchRow: { marginBottom: 12 },
  searchInput: {
    backgroundColor: NEUTRAL.surface,
    borderWidth: 0.5,
    borderColor: NEUTRAL.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 13,
    color: NEUTRAL.textPrimary,
  },
  gridTitle: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textSecondary, marginBottom: 10 },
  specGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  specItem: { width: "25%", alignItems: "center", marginBottom: 14 },
  specCircle: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  specLabel: { fontSize: 10, color: NEUTRAL.textSecondary, textAlign: "center" },
  hospitalHeading: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textPrimary, marginTop: 10, marginBottom: 8 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: NEUTRAL.border },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "700", fontSize: 13 },
  docName: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary },
  docSpec: { fontSize: 11, color: NEUTRAL.textSecondary, marginTop: 1 },
  docMeta: { fontSize: 10, color: NEUTRAL.textMuted, marginTop: 2 },
  bookBtn: { paddingHorizontal: 16, paddingVertical: 9, flexShrink: 0 },
});
