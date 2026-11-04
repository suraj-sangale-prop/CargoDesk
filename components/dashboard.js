import React, { useEffect, useState } from "react";
import CommonModal from "./common/commonModal";
import DocumentsSection from "./layouts/documentsSection";
import EmiSection from "./layouts/emiSection";
import { postApiData } from "@/utilities/services/apiService";
import AddDocumentForm from "./common/molecules/addDocumentForm";
import DocumentTabs from "./dashboard/documentTabs";
import PageHeader from "./common/pageHeader";

const Dashboard = ({ pageData }) => {
  const [reminderModal, setReminderModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [reminderData, setReminderData] = useState("");
  const [focusField, setFocusField] = useState(null);
  const [documentTableData, setDocumentTableData] = useState(pageData.documentsList);
  const [selectedTab, setSelectedTab] = useState("document");

  const addReminderData = async (data) => {
    const payload = {
      fleet_id: data.fleet_id || data.fleetId || null,
      fleetId: data.fleet_id || data.fleetId || null,
      vehicleNo: data.vehicleNo || null,
      documentType: data.documentType,
      expiryDate: data.expiryDate,
      note: data.note,
    };
    setAddLoading(true);
    try {
      const response = await postApiData("ADD_NEW_VEHICALE_DOCUMENTS", payload);
      if (response.status) {
        const docId = response.id || response.data?.id;
        const LatestData = [
          ...documentTableData,
          {
            ...data,
            id: docId,
            fleet_id: response.fleet_id || data.fleet_id || data.fleetId,
            vehicleNo: response.vehicleNo || data.vehicleNo,
          },
        ];
        setDocumentTableData(LatestData);
        setReminderModal(false);
      }
    } catch (error) {
      console.error("Error occurred during form submission:", error);
      setAddLoading(false);
    }
  };

  const updateReminderData = async (updatedData) => {
    const payload = {
      id: updatedData.id,
      fleet_id: updatedData.fleet_id || updatedData.fleetId || null,
      fleetId: updatedData.fleet_id || updatedData.fleetId || null,
      vehicleNo: updatedData.vehicleNo || null,
      documentType: updatedData.documentType,
      expiryDate: updatedData.expiryDate,
      note: updatedData.note,
    };
    setUpdateLoading(true);
    try {
      const response = await postApiData("UPDATE_VEHICALE_DOCUMENTS", payload);
      if (response.status || response.success) {
        setDocumentTableData((prevData) =>
          prevData.map((item) =>
            item.id === updatedData.id ? { ...item, ...updatedData } : item
          )
        );
      }
      setReminderModal(false);
      setIsEdit(false);
    } catch (error) {
      console.error("Error occurred during form submission:", error);
    }
    setUpdateLoading(false);
  };

  const onClickAddReminder = () => {
    setIsEdit(false);
    setReminderData("");
    setFocusField(null);
    setReminderModal(true);
  };

  // const getAllVehicleDocuments = async () => {
  //   setTableLoading(true);
  //   try {
  //     const response = await postApiData("GET_ALL_VEHICALE_DOCUMENTS");
  //     if (response.status && response.data.length > 0) {
  //       setDocumentTableData(response.data);
  //     } else {
  //       setDocumentTableData([]);
  //     }
  //   } catch (error) {
  //     console.error("Error occurred during fetching vehicle documents:", error);
  //   } finally {
  //     setTableLoading(false);
  //   }
  // };

  // useEffect(() => {
  //   getAllVehicleDocuments();
  // }, []);

  return (
    <div className="w-full">
      {/* Page Header (Eyebrow, Title, Subtitle, Vector Illustration) */}
      <PageHeader
        eyebrow=""
        title="Dashboard"
        subtitle="Track and manage all your vehicle documents in one place."
      />

      {/* Tabs (Documents vs EMI) */}
      <DocumentTabs
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
      />

      {/* Main Tab Content */}
      <div className="w-full">
        {selectedTab === "document" ? (
          <DocumentsSection
            setReminderData={setReminderData}
            setReminderModal={setReminderModal}
            setIsEdit={setIsEdit}
            setFocusField={setFocusField}
            tableData={documentTableData}
            setTableData={setDocumentTableData}
            onClickAddDocument={onClickAddReminder}
            isLoading={tableLoading}
          />
        ) : selectedTab === "emi" ? (
          <EmiSection />
        ) : null}
      </div>

      {/* Add / Edit Document Modal */}
      <CommonModal
        modalTitle={isEdit ? "Edit Document" : "Add New Document"}
        modalOpen={reminderModal}
        setModalOpen={setReminderModal}
        modalSize="w-11/12 md:w-[500px]"
      >
        <AddDocumentForm
          setReminderModal={setReminderModal}
          addReminderData={addReminderData}
          reminderData={reminderData}
          isEdit={isEdit}
          setIsEdit={setIsEdit}
          focusField={focusField}
          isLoading={isEdit ? updateLoading : addLoading}
          updateReminderData={updateReminderData}
        />
      </CommonModal>
    </div>
  );
};

export default Dashboard;
