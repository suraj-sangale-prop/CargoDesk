import {
  addNewVehicleDocument,
  deleteVehicleDocumentByIds,
  editVehicleDocumentById,
  getAllVehicleDocuments,
} from "../models/vehicleDocumentModel";

// export function addNewVehicleDocumentController(request) {
export function addNewVehicleDocumentController(request, authUser = null) {
  return new Promise((resolve, reject) => {
    const response = {
      status: false,
    };

    addNewVehicleDocument(request, authUser)
      .then((result) => {
        if (result) {
          response.status = true; // test
          response.id = result.id;
          response.message = "Vehicle document added successfully";
          resolve(response);
        } else {
          response.message = "Failed to add vehicle document.";
          resolve(response);
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}

export function getAllVehicleDocumentsController(authUser) {
  return new Promise((resolve, reject) => {
    const response = {
      status: false,
    };

    getAllVehicleDocuments(authUser)
      .then((result) => {
        response.status = true;
        response.data = result.data;
        response.message = "Data retrieved successfully";
        resolve(response);
      })
      .catch((error) => {
        response.message = "Failed to fetch data.";
        reject(error);
      });
  });
}

export function deleteVehicleDocumentController(id) {
  return new Promise((resolve, reject) => {
    const response = {
      status: false,
    };

    deleteVehicleDocumentByIds(id)
      .then((result) => {
        if (result) {
          response.status = true;
          response.message = "Vehicle document deleted successfully";
          resolve(response);
        } else {
          response.message = "No record found with the given ID.";
          resolve(response);
        }
      })
      .catch((error) => {
        response.message = "Failed to delete vehicle document.";
        reject(error);
      });
  });
}

export function editVehicleDocumentController(request) {
  return new Promise((resolve, reject) => {
    const response = {
      status: false,
    };

    const id = request.id;
    const updatedFields = {
      id: request.id,
      fleet_id: request.fleet_id || request.fleetId || null,
      vehicleNo: request.vehicleNo || null,
      documentType: request.documentType,
      expiryDate: request.expiryDate,
      note: request.note,
      performedByName: request.performedByName,
    };

    editVehicleDocumentById(id, updatedFields)
      .then((result) => {
        if (result) {
          response.status = true;
          response.message = "Vehicle document updated successfully";
          resolve(response);
        } else {
          response.message =
            "No record found with the given ID or no changes made.";
          resolve(response);
        }
      })
      .catch((error) => {
        response.message = "Failed to update vehicle document.";
        reject(error);
      });
  });
}
