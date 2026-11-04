import { getAllVehicleDocumentsController } from "@/backend/controllers/vehicleDocumentController";
import { getAllFleetsController } from "@/backend/controllers/fleetController";
import DocumetsWrapper from "@/components/documents/documetsWrapper";
import { withUserSsr } from "@/utilities/withUserSsr";
import React from "react";

export default function Documents({ pageData }) {
  return <DocumetsWrapper pageData={pageData} />;
}

export const getServerSideProps = withUserSsr(async (context, { user }) => {
  const pageData = {};

  try {
    const [documents, fleetsRes] = await Promise.all([
      getAllVehicleDocumentsController(user),
      getAllFleetsController(),
    ]);

    if (documents?.status && Array.isArray(documents.data)) {
      pageData.documents = documents.data;
    }
    if (fleetsRes?.status && Array.isArray(fleetsRes.data)) {
      pageData.fleets = fleetsRes.data;
    }
  } catch (error) {
    console.error("Error in SSR documents page:", error);
  }

  return {
    props: {
      pageData,
    },
  };
});
