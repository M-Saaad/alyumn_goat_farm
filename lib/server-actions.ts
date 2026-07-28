"use server";

import { redirect } from "next/navigation";
import {
  addPurchasePayment,
  addSaleReceipt,
  buyGoat,
  changeStatus,
  deleteTransaction,
  deleteAnimal,
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
import { LEDGER_CATEGORIES } from "@/lib/types";
import { uploadAnimalMedia } from "@/lib/media/upload";
import type { TransactionEditVariant } from "@/lib/transactions/mutate";

function revalidateTxnPaths() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/animals");
}

export async function actionLogExpense(formData: FormData) {
  const date = String(formData.get("date") || "").trim();
  const amountRaw = String(formData.get("amount") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const paidBy = String(formData.get("paidBy") || "").trim();
  const animalRaw = String(formData.get("animalId") || "").trim();
  const notes = String(formData.get("notes") || "");

  if (!date) throw new Error("Date is required");
  const amount = Number(amountRaw);
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }
  if (!(LEDGER_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error("Invalid category");
  }
  if (paidBy !== "Monis" && paidBy !== "Saad") {
    throw new Error("Select who paid (Monis or Saad)");
  }

  await logExpense({
    date,
    amount,
    category: category as LedgerCategory,
    paidBy,
    animalId: animalRaw ? Number(animalRaw) : null,
    notes,
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
  const paidNowRaw = String(formData.get("paidNow") || "").trim();
  if (paidBy !== "Customer" && !priceRaw) {
    throw new Error("Price is required");
  }
  await buyGoat({
    date: String(formData.get("date")),
    price: priceRaw ? Number(priceRaw) : null,
    paidNow: paidNowRaw ? Number(paidNowRaw) : null,
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
  const date = String(formData.get("date") || "").trim();
  const animalId = Number(formData.get("animalId"));
  const grossSalePrice = Number(String(formData.get("grossSalePrice") || "").trim());
  const deliveryRaw = String(formData.get("deliveryCost") || "").trim();
  const receivedBy = String(formData.get("receivedBy") || "").trim();
  const additional = String(formData.get("additionalAnimalId") || "").trim();
  const receivedNowRaw = String(formData.get("amountReceivedNow") || "").trim();

  if (!date) throw new Error("Sale date is required");
  if (!animalId || Number.isNaN(animalId)) throw new Error("Select a goat");
  if (!grossSalePrice || Number.isNaN(grossSalePrice) || grossSalePrice <= 0) {
    throw new Error("Gross sale price must be a positive number");
  }
  if (receivedBy !== "Monis" && receivedBy !== "Saad") {
    throw new Error("Select who received cash (Monis or Saad)");
  }
  if (receivedNowRaw) {
    const receivedNow = Number(receivedNowRaw);
    if (Number.isNaN(receivedNow) || receivedNow < 0) {
      throw new Error("Received now must be zero or a positive number");
    }
  }

  await recordLivestockSale({
    date,
    animalId,
    additionalAnimalIds: additional ? [Number(additional)] : undefined,
    grossSalePrice,
    deliveryCost: deliveryRaw ? Number(deliveryRaw) : undefined,
    receivedBy: receivedBy as "Monis" | "Saad",
    amountReceivedNow: receivedNowRaw ? Number(receivedNowRaw) : null,
    notes: String(formData.get("notes") || "") || undefined,
  });
  revalidateTxnPaths();
}

export async function actionAddPurchasePayment(formData: FormData) {
  const amount = Number(formData.get("amount"));
  if (!amount || Number.isNaN(amount) || amount <= 0) {
    throw new Error("Amount must be positive");
  }
  const paidBy = String(formData.get("paidBy"));
  if (paidBy !== "Monis" && paidBy !== "Saad" && paidBy !== "Customer") {
    throw new Error("Select who paid");
  }
  await addPurchasePayment({
    animalId: Number(formData.get("animalId")),
    date: String(formData.get("date")),
    amount,
    paidBy,
    notes: String(formData.get("notes") || "") || undefined,
  });
  const id = Number(formData.get("animalId"));
  revalidatePath(`/animals/${id}`);
  revalidateTxnPaths();
}

export async function actionAddSaleReceipt(formData: FormData) {
  const amount = Number(formData.get("amount"));
  if (!amount || Number.isNaN(amount) || amount <= 0) {
    throw new Error("Amount must be positive");
  }
  await addSaleReceipt({
    animalId: Number(formData.get("animalId")),
    date: String(formData.get("date")),
    amount,
    receivedBy: String(formData.get("receivedBy")) as "Monis" | "Saad",
    notes: String(formData.get("notes") || "") || undefined,
  });
  const id = Number(formData.get("animalId"));
  revalidatePath(`/animals/${id}`);
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
  const statusRaw = String(formData.get("status") || "").trim();
  const purchasePriceRaw = String(formData.get("purchasePrice") || "").trim();
  const purchasePaidRaw = String(formData.get("purchasePaid") || "").trim();
  const soldPriceRaw = String(formData.get("soldPrice") || "").trim();
  const saleDateRaw = String(formData.get("saleDate") || "").trim();
  const deliveryRaw = String(formData.get("deliveryCost") || "").trim();
  const receivedRaw = String(formData.get("amountReceived") || "").trim();
  const purchaseDateRaw = String(formData.get("purchaseDate") || "").trim();
  const outDateRaw = String(formData.get("outDate") || "").trim();

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
    status: statusRaw ? (statusRaw as AnimalStatus) : undefined,
    date_of_purchase: purchaseDateRaw || null,
    purchase_price: purchasePriceRaw ? Number(purchasePriceRaw) : null,
    purchase_paid: purchasePaidRaw ? Number(purchasePaidRaw) : null,
    out_date: outDateRaw || null,
    sold_price: soldPriceRaw ? Number(soldPriceRaw) : null,
    sale_date: saleDateRaw || null,
    gross_sale_price: soldPriceRaw ? Number(soldPriceRaw) : null,
    delivery_cost: deliveryRaw ? Number(deliveryRaw) : null,
    amount_received: receivedRaw ? Number(receivedRaw) : null,
  });
  revalidatePath(`/animals/${id}`);
  revalidateTxnPaths();
}

export async function actionDeleteAnimal(formData: FormData) {
  const animalId = Number(formData.get("animalId"));
  if (!animalId || Number.isNaN(animalId)) {
    throw new Error("Animal id is required");
  }
  await deleteAnimal(animalId);
  revalidateTxnPaths();
  redirect("/animals");
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

/** Batch-sign media storage paths after first paint (client gallery). */
export async function actionSignMediaUrls(
  paths: string[]
): Promise<Record<string, string | null>> {
  const { signedMediaUrl } = await import("@/lib/media/upload");
  const entries = await Promise.all(
    paths.map(async (p) => [p, await signedMediaUrl(p)] as const)
  );
  return Object.fromEntries(entries);
}

export async function actionSignOut() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
