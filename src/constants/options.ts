import { SelectOption } from "@/components/SelectField";

export const GENDER_OPTIONS: SelectOption[] = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
  { value: "O", label: "Other" },
];

export const DOC_TYPE_OPTIONS: SelectOption[] = [
  { value: "lab_report", label: "Lab report" },
  { value: "prescription", label: "Prescription" },
  { value: "scan", label: "Scan / Imaging" },
  { value: "discharge_summary", label: "Discharge summary" },
  { value: "other", label: "Other" },
];

export const RELATIONSHIP_OPTIONS: SelectOption[] = [
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "spouse", label: "Spouse" },
  { value: "brother", label: "Brother" },
  { value: "sister", label: "Sister" },
  { value: "grandfather", label: "Grandfather" },
  { value: "grandmother", label: "Grandmother" },
  { value: "guardian", label: "Guardian" },
  { value: "other", label: "Other" },
];
