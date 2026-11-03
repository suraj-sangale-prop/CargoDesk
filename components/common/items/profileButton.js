import { useState, useRef, useEffect } from "react";
import { convertFirstLetterCapital } from "@/utilities/utils";
import CommonModal from "../commonModal";
import ResetConfirmation from "./commonConfirmation";

const ProfileButton = ({ username, onclickLogOut }) => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [confirmationPopUp, setConfirmationPopUp] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  const convetedUserName = convertFirstLetterCapital(username);

  // Function to toggle dropdown visibility
  const toggleDropdown = () => {
    setDropdownVisible(!dropdownVisible);
  };

  // Function to close dropdown when clicking outside
  const handleClickOutside = (event) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target) &&
      buttonRef.current &&
      !buttonRef.current.contains(event.target)
    ) {
      setDropdownVisible(false); // Close dropdown if clicked outside
    }
  };

  // Set up event listener on component mount and cleanup on unmount
  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative">
      {/* Profile Button (circular) */}
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold"
      >
        {/* Use initial letter or profile image */}
        <span className="text-lg">{convetedUserName[0]}</span>
      </button>

      {/* Dropdown Menu */}
      {dropdownVisible && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg transition-all transform scale-95 opacity-100 animate-dropdown"
        >
          <div className="p-3 text-gray-800 ">{convetedUserName}</div>
          <div className="">
            <button
              onClick={() => setConfirmationPopUp(true)}
              className="w-full text-left p-3 text-red-600 font-semibold transition-all cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      )}
      <CommonModal
        modalOpen={confirmationPopUp}
        setModalOpen={setConfirmationPopUp}
        backDrop={false}
      >
        <ResetConfirmation
          title={"Are You Sure Want To Log Out?"}
          onConfirm={() => {
            onclickLogOut();
          }}
          onCancel={() => {
            setConfirmationPopUp(false);
          }}
        />
      </CommonModal>
    </div>
  );
};

export default ProfileButton;
