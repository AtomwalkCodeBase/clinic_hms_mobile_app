import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, EmptyState, ErrorBanner, SectionTitle } from "@/components/Layout";
import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { DOC_TYPE_OPTIONS } from "@/constants/options";
import { DownloadButton } from "@/components/DownloadButton";
import { getMyDocuments, getDocumentDetail, uploadDocument } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { pickPdf, pickImage, fileToDataUri, downloadDataUri, PickedFile } from "@/utils/fileHelpers";
import { PatientDocument } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

function docTypeLabel(t: string): string {
  return DOC_TYPE_OPTIONS.find((o) => o.value === t)?.label || t;
}

export function DocumentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("lab_report");
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDocuments(await getMyDocuments());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const downloadDoc = async (doc: PatientDocument) => {
    const full = await getDocumentDetail(doc.id);
    await downloadDataUri(full.file_name || full.title, full.file_data);
  };

  const resetUploadForm = () => {
    setTitle("");
    setDocType("lab_report");
    setPicked(null);
    setUploadError("");
  };

  const onSaveUpload = async () => {
    if (!title.trim()) {
      setUploadError("Give this document a title.");
      return;
    }
    if (!picked) {
      setUploadError("Choose a PDF or photo first.");
      return;
    }
    setUploadError("");
    setSaving(true);
    try {
      const dataUri = await fileToDataUri(picked);
      await uploadDocument({
        title: title.trim(),
        doc_type: docType,
        file_name: picked.name,
        mime_type: picked.mimeType,
        file_data: dataUri,
      });
      setShowUpload(false);
      resetUploadForm();
      load();
    } catch (err) {
      setUploadError(apiErrorMessage(err, "Couldn't upload this document."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <BackHeader title="My documents" onBack={() => navigation.goBack()} />
      <Text style={styles.hint}>
        Keep lab reports, prescriptions, or scans from outside this network here — any doctor you visit can see
        them with your consent.
      </Text>

      {!!error && <ErrorBanner message={error} onRetry={load} />}

      {!showUpload ? (
        <SecondaryButton label="+ Upload a document" onPress={() => setShowUpload(true)} style={{ marginBottom: 14 }} />
      ) : (
        <Card>
          <SectionTitle>Upload a document</SectionTitle>
          {!!uploadError && <ErrorBanner message={uploadError} />}
          <TextField label="Title" placeholder="e.g. CBC report — City Diagnostics" value={title} onChangeText={setTitle} />
          <SelectField label="Type" value={docType} options={DOC_TYPE_OPTIONS} onChange={setDocType} />

          <Text style={styles.pickLabel}>File</Text>
          {picked ? (
            <Text style={styles.pickedName}>{picked.name}</Text>
          ) : (
            <Text style={styles.pickedNone}>No file chosen yet.</Text>
          )}
          <View style={styles.pickRow}>
            <SecondaryButton
              label="Choose PDF"
              onPress={async () => {
                const f = await pickPdf();
                if (f) setPicked(f);
              }}
              style={{ flex: 1, paddingVertical: 9 }}
            />
            <SecondaryButton
              label="Choose photo"
              onPress={async () => {
                const f = await pickImage();
                if (f) setPicked(f);
              }}
              style={{ flex: 1, paddingVertical: 9 }}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
            <SecondaryButton
              label="Cancel"
              onPress={() => {
                setShowUpload(false);
                resetUploadForm();
              }}
              style={{ flex: 1 }}
            />
            <PrimaryButton label="Save" onPress={onSaveUpload} loading={saving} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {documents.length === 0 && !loading ? (
        <EmptyState text="No documents uploaded yet." />
      ) : (
        documents.map((d) => (
          <Card key={d.id}>
            <View style={styles.rowBetween}>
              <Text style={styles.docTitle}>{d.title}</Text>
              <Text style={styles.docMeta}>{d.created_at.slice(0, 10)}</Text>
            </View>
            <Text style={styles.docSub}>
              {docTypeLabel(d.doc_type)} · {d.uploaded_by === "patient" ? "Uploaded by you" : "From a hospital visit"}
            </Text>
            <DownloadButton fileLabel={d.title} onDownload={() => downloadDoc(d)} style={{ marginTop: 10, paddingVertical: 9 }} />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginBottom: 14, lineHeight: 16 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  docTitle: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary, flex: 1, marginRight: 8 },
  docMeta: { fontSize: 10, color: NEUTRAL.textMuted },
  docSub: { fontSize: 11, color: NEUTRAL.textSecondary, marginTop: 4 },
  pickLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: NEUTRAL.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  pickedName: { fontSize: 12.5, color: NEUTRAL.textPrimary, marginBottom: 8 },
  pickedNone: { fontSize: 12, color: NEUTRAL.textMuted, marginBottom: 8 },
  pickRow: { flexDirection: "row", gap: 8 },
});
