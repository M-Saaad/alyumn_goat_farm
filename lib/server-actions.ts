"use server";

import {
  buyGoat,
  changeStatus,
  deleteTransaction,
  logExpense,
  logMedical,
  partnerTransfer,
  recordBreeding,
  recordLivestockSale,
  recordPalai,
  updateAnimal,
  updateTransaction,
} from "@/lib/actions";
import { revalidatePath } from "next/cache";
import type { AnimalBreed, AnimalSex, AnimalStatus, LedgerCategory, MedicalEventType } from "@/lib/types";
import { uploadAnimalMedia } from "@/lib/media/upload";
import type { TransactionEditVariant } from "@/lib/transactions/mutate";

function revalidateTxnPaths() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/animals");
}

export async function actionLogExpense(formData: FormData) {
  await logExpense({
    date: String(formData.get("date")),
    amount: Number(formData.get("amount")),
    category: String(formData.get("category")) as LedgerCategory,
    paidBy: String(formData.get("paidBy")) as "Monis" | "Saad",
    animalId: formData.get("animalId") ? Number(formData.get("animalId")) : null,
    notes: String(formData.get("notes") || ""),
  });
  revalidateTxnPaths();
}

export async function actionRecordPalai(formData: FormData) {
  await recordPalai({
    date: String(formData.get("date")),
    customerName: String(formData.get("customerName")),
    ratePerGoat: Number(formData.get("ratePerGoat")),
    goatCount: Number(formData.get("goatCount")),
    paymentMethod: String(formData.get("paymentMethod") || ""),
    notes: String(formData.get("notes") || ""),
  });
  revalidateTxnPaths();
}

export async function actionBuyGoat(formData: FormData) {
  const palaiRaw = String(formData.get("palaiRate") || "").trim();
  const paidBy = String(formData.get("paidBy")) as "Monis" | "Saad" | "Customer";
  const priceRaw = String(formData.get("price") || "").trim();
  if (paidBy !== "Customer" && !priceRaw) {
    throw new Error("Price is required");
  }
  await buyGoat({
    date: String(formData.get("date")),
    price: priceRaw ? Number(priceRaw) : null,
    breed: String(formData.get("breed")) as AnimalBreed,
    sex: String(formData.get("sex")) as AnimalSex,
    description: String(formData.get("description")),
    name: String(formData.get("name") || "") || undefined,
    ownerName: String(formData.get("ownerName")),
    vendorName: String(formData.get("vendorName") || "") || undefined,
    paidBy,
    palaiRate: palaiRaw ? Number(palaiRaw) : null,
  });
  revalidateTxnPaths();
}

export async function actionLogMedical(formData: FormData) {
  await logMedical({
    animalId: Number(formData.get("animalId")),
    eventType: String(formData.get("eventType")) as MedicalEventType,
    date: String(formData.get("date")),
    notes: String(formData.get("notes") || ""),
  });
  revalidateTxnPaths();
}

export async function actionRecordBreeding(formData: FormData) {
  const maleRaw = String(formData.get("maleAnimalId") || "").trim();
  await recordBreeding({
    femaleId: Number(formData.get("femaleId")),
    buckName: String(formData.get("buckName")),
    maleAnimalId: maleRaw ? Number(maleRaw) : null,
    dateCrossed: String(formData.get("dateCrossed")),
    notes: String(formData.get("notes") || ""),
  });
  revalidateTxnPaths();
}

export async function actionChangeStatus(formData: FormData) {
  await changeStatus({
    animalId: Number(formData.get("animalId")),
    status: String(formData.get("status")) as AnimalStatus,
    outDate: String(formData.get("outDate") || "") || undefined,
  });
  revalidateTxnPaths();
}

export async function actionRecordLivestockSale(formData: FormData) {
  const additional = String(formData.get("additionalAnimalId") || "").trim();
  await recordLivestockSale({
    date: String(formData.get("date")),
    animalId: Number(formData.get("animalId")),
    additionalAnimalIds: additional ? [Number(additional)] : undefined,
    grossSalePrice: Number(formData.get("grossSalePrice")),
    deliveryCost: formData.get("deliveryCost") ? Number(formData.get("deliveryCost")) : undefined,
    receivedBy: String(formData.get("receivedBy")) as "Monis" | "Saad",
    notes: String(formData.get("notes") || "") || undefined,
  });
  revalidateTxnPaths();
}

export async function actionPartnerTransfer(formData: FormData) {
  await partnerTransfer({
    date: String(formData.get("date")),
    amount: Number(formData.get("amount")),
    direction: String(formData.get("direction")) as "from_monis" | "to_monis",
    notes: String(formData.get("notes") || ""),
  });
  revalidateTxnPaths();
}

export async function actionUpdateTransaction(formData: FormData) {
  const id = String(formData.get("id"));
  const variant = String(formData.get("variant")) as TransactionEditVariant;

  if (variant === "expense") {
    const animalRaw = String(formData.get("animalId") || "").trim();
    await updateTransaction({
      id,
      variant: "expense",
      date: String(formData.get("date")),
      amount: Number(formData.get("amount")),
      category: String(formData.get("category")) as LedgerCategory,
      paidBy: String(formData.get("paidBy")) as "Monis" | "Saad",
      animalId: animalRaw ? Number(animalRaw) : null,
      notes: String(formData.get("notes") || "") || null,
    });
  } else if (variant === "livestock_purchase") {
    await updateTransaction({
      id,
      variant: "livestock_purchase",
      date: String(formData.get("date")),
      amount: Number(formData.get("amount")),
      paidBy: String(formData.get("paidBy")) as "Monis" | "Saad",
      vendorName: String(formData.get("vendorName") || ""),
      notes: String(formData.get("notes") || "") || null,
    });
  } else if (variant === "partner_transfer") {
    await updateTransaction({
      id,
      variant: "partner_transfer",
      date: String(formData.get("date")),
      amount: Number(formData.get("amount")),
      direction: String(formData.get("direction")) as "from_monis" | "to_monis",
      notes: String(formData.get("notes") || "") || null,
    });
  } else if (variant === "palai_income") {
    await updateTransaction({
      id,
      variant: "palai_income",
      date: String(formData.get("date")),
      customerName: String(formData.get("customerName")),
      ratePerGoat: Number(formData.get("ratePerGoat")),
      goatCount: Number(formData.get("goatCount")),
      paymentMethod: String(formData.get("paymentMethod") || "") || null,
      notes: String(formData.get("notes") || "") || null,
    });
  } else if (variant === "livestock_sale") {
    const additional = String(formData.get("additionalAnimalId") || "").trim();
    await updateTransaction({
      id,
      variant: "livestock_sale",
      date: String(formData.get("date")),
      animalId: Number(formData.get("animalId")),
      additionalAnimalIds: additional ? [Number(additional)] : undefined,
      grossSalePrice: Number(formData.get("grossSalePrice")),
      deliveryCost: formData.get("deliveryCost") ? Number(formData.get("deliveryCost")) : 0,
      receivedBy: String(formData.get("receivedBy")) as "Monis" | "Saad",
      notes: String(formData.get("notes") || "") || null,
    });
  } else {
    throw new Error(`Unknown edit variant: ${variant}`);
  }

  revalidateTxnPaths();
}

export async function actionDeleteTransaction(formData: FormData) {
  const id = String(formData.get("id"));
  await deleteTransaction(id);
  revalidateTxnPaths();
}

export async function actionUpdateAnimal(formData: FormData) {
  const id = Number(formData.get("id"));
  const palaiRaw = String(formData.get("palaiRate") || "").trim();
  const breedRaw = String(formData.get("breed") || "").trim();
  const sexRaw = String(formData.get("sex") || "").trim();
  await updateAnimal({
    id,
    name: String(formData.get("name") || "") || null,
    breed: breedRaw ? (breedRaw as AnimalBreed) : null,
    sex: sexRaw ? (sexRaw as AnimalSex) : null,
    description: String(formData.get("description") || "") || null,
    comment: String(formData.get("comment") || "") || null,
    ownerName: String(formData.get("ownerName")),
    vendorName: String(formData.get("vendorName") || "") || null,
    palai_rate: palaiRaw ? Number(palaiRaw) : null,
    age_at_purchase: String(formData.get("ageAtPurchase") || "") || null,
    home_bred: formData.get("homeBred") === "on" || formData.get("homeBred") === "true",
  });
  revalidatePath(`/animals/${id}`);
  revalidateTxnPaths();
}

export async function actionUploadAnimalMedia(formData: FormData) {
  const animalId = Number(formData.get("animalId"));
  const file = formData.get("file");
  const caption = String(formData.get("caption") || "") || null;
  if (!(file instanceof File) || !file.size) {
    throw new Error("File is required");
  }
  await uploadAnimalMedia({ animalId, file, caption });
  revalidatePath(`/animals/${animalId}`);
  revalidatePath("/animals");
}

export async function actionSignOut() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
