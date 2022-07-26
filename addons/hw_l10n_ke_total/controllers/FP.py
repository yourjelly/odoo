#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Tremol fiscal printer python module."""
from .FP_core import FP_core
from enum import Enum
from datetime import datetime


class FP(FP_core):
    """Tremol fiscal printer python library."""

    FP_core._timestamp = 2204120945

    def AddNewHScode(self, HS_Code, HS_Name, OptionTaxable, MesureUnit, VAT_rate):
        """
        Programs the customer DB for special customer receipt issuing.\n
        :param HS_Code: 10 symbols for HS code\n
        :type HS_Code: str\n
        :param HS_Name: 20 symbols for name of HS group\n
        :type HS_Name: str\n
        :param OptionTaxable: 1 symbol for parameter: 
        - '1' - Exempted 
        - '0' - Taxable\n
        :type OptionTaxable: Enums.OptionTaxable\n
        :param MesureUnit: 3 symbols for mesure unit of item's code\n
        :type MesureUnit: str\n
        :param VAT_rate: Value of VAT rate from 2 to 5 symbols with format ##.##\n
        :type VAT_rate: float\n
        """
        self.do("AddNewHScode", 'HS_Code', HS_Code, 'HS_Name', HS_Name, 'OptionTaxable', OptionTaxable, 'MesureUnit', MesureUnit, 'VAT_rate', VAT_rate)

    def CancelReceipt(self):
        """
        Available only if the receipt is not closed. Cancel all sales in the receipt and close it .\n
        """
        self.do("CancelReceipt")

    def ClearDisplay(self):
        """
        Clears the external display.\n
        """
        self.do("ClearDisplay")

    def CloseReceipt(self):
        """
        Closes the opened fiscal receipt and returns receipt info.\n
        """
        return __CloseReceiptRes__(*self.do("CloseReceipt"))

    def ConfirmFiscalization(self, Password):
        """
        Confirm PIN number.\n
        :param Password: 6-symbols string\n
        :type Password: str\n
        """
        self.do("ConfirmFiscalization", 'Password', Password)

    def DailyReport(self):
        """
        Provides information for the daily fiscal report  with zeroing and fiscal memory record, preceded by Electronic Journal report.\n
        """
        self.do("DailyReport")

    def DirectCommand(self, Input):
        """
        Executes the direct command .\n
        :param Input: Raw request to FP\n
        :type Input: str\n
        :rtype: str
        """
        return self.do("DirectCommand", 'Input', Input)

    def DisplayDateTime(self):
        """
        Shows the current date and time on the external display.\n
        """
        self.do("DisplayDateTime")

    def DisplayTextLine1(self, Text):
        """
        Shows a 20-symbols text in the upper external display line.\n
        :param Text: 16 symbols text\n
        :type Text: str\n
        """
        self.do("DisplayTextLine1", 'Text', Text)

    def DisplayTextLine2(self, Text):
        """
        Shows a 16-symbols text in the lower external display line.\n
        :param Text: 16 symbols text\n
        :type Text: str\n
        """
        self.do("DisplayTextLine2", 'Text', Text)

    def DisplayTextLines1and2(self, Text):
        """
        Shows a 16-symbols text in the first line and last 16-symbols text in the second line of the external display lines.\n
        :param Text: 32 symbols text\n
        :type Text: str\n
        """
        self.do("DisplayTextLines1and2", 'Text', Text)

    def EraseHScodes(self, Password):
        """
        Erase HS codes.\n
        :param Password: 6 symbols for password\n
        :type Password: str\n
        """
        self.do("EraseHScodes", 'Password', Password)

    def InfoLastReceiptDuplicate(self):
        """
        Informs about the issued document\n
        """
        self.do("InfoLastReceiptDuplicate")

    def OpenCreditNoteWithFreeCustomerData(self, CompanyName, ClientPINnum, HeadQuarters, Address, PostalCodeAndCity, ExemptionNum, RelatedInvoiceNum, TraderSystemInvNum):
        """
        Opens a fiscal invoice credit note receipt assigned to the specified operator number and operator password with free info for customer data. The Invoice receipt can be issued only if the invoice range (start and end numbers) is set.\n
        :param CompanyName: 30 symbols for Invoice company name\n
        :type CompanyName: str\n
        :param ClientPINnum: 14 symbols for client PIN number\n
        :type ClientPINnum: str\n
        :param HeadQuarters: 30 symbols for customer headquarters\n
        :type HeadQuarters: str\n
        :param Address: 30 symbols for Address\n
        :type Address: str\n
        :param PostalCodeAndCity: 30 symbols for postal code and city\n
        :type PostalCodeAndCity: str\n
        :param ExemptionNum: 30 symbols for exemption number\n
        :type ExemptionNum: str\n
        :param RelatedInvoiceNum: 19 symbols for the related invoice number in format 
        ###################\n
        :type RelatedInvoiceNum: str\n
        :param TraderSystemInvNum: 15 symbols for trader system invoice number\n
        :type TraderSystemInvNum: str\n
        """
        self.do("OpenCreditNoteWithFreeCustomerData", 'CompanyName', CompanyName, 'ClientPINnum', ClientPINnum, 'HeadQuarters', HeadQuarters, 'Address', Address, 'PostalCodeAndCity', PostalCodeAndCity, 'ExemptionNum', ExemptionNum, 'RelatedInvoiceNum', RelatedInvoiceNum, 'TraderSystemInvNum', TraderSystemInvNum)

    def OpenDebitNoteWithFreeCustomerData(self, CompanyName, ClientPINnum, HeadQuarters, Address, PostalCodeAndCity, ExemptionNum, RelatedInvoiceNum, TraderSystemInvNum):
        """
        Opens a fiscal invoice debit note receipt assigned to the specified operator number and operator password with free info for customer data. The Invoice receipt can be issued only if the invoice range (start and end numbers) is set.\n
        :param CompanyName: 30 symbols for Invoice company name\n
        :type CompanyName: str\n
        :param ClientPINnum: 14 symbols for client PIN number\n
        :type ClientPINnum: str\n
        :param HeadQuarters: 30 symbols for customer headquarters\n
        :type HeadQuarters: str\n
        :param Address: 30 symbols for Address\n
        :type Address: str\n
        :param PostalCodeAndCity: 30 symbols for postal code and city\n
        :type PostalCodeAndCity: str\n
        :param ExemptionNum: 30 symbols for exemption number\n
        :type ExemptionNum: str\n
        :param RelatedInvoiceNum: 19 symbols for the related invoice number in format 
        ###################\n
        :type RelatedInvoiceNum: str\n
        :param TraderSystemInvNum: 15 symbols for trader system invoice number\n
        :type TraderSystemInvNum: str\n
        """
        self.do("OpenDebitNoteWithFreeCustomerData", 'CompanyName', CompanyName, 'ClientPINnum', ClientPINnum, 'HeadQuarters', HeadQuarters, 'Address', Address, 'PostalCodeAndCity', PostalCodeAndCity, 'ExemptionNum', ExemptionNum, 'RelatedInvoiceNum', RelatedInvoiceNum, 'TraderSystemInvNum', TraderSystemInvNum)

    def OpenInvoiceWithFreeCustomerData(self, CompanyName, ClientPINnum, HeadQuarters, Address, PostalCodeAndCity, ExemptionNum, TraderSystemInvNum):
        """
        Opens a fiscal invoice receipt assigned to the specified operator number and operator password with free info for customer data. The Invoice receipt can be issued only if the invoice range (start and end numbers) is set.\n
        :param CompanyName: 30 symbols for Invoice company name\n
        :type CompanyName: str\n
        :param ClientPINnum: 14 symbols for client PIN number\n
        :type ClientPINnum: str\n
        :param HeadQuarters: 30 symbols for customer headquarters\n
        :type HeadQuarters: str\n
        :param Address: 30 symbols for Address\n
        :type Address: str\n
        :param PostalCodeAndCity: 30 symbols for postal code and city\n
        :type PostalCodeAndCity: str\n
        :param ExemptionNum: 30 symbols for exemption number\n
        :type ExemptionNum: str\n
        :param TraderSystemInvNum: 15 symbols for trader system invoice number\n
        :type TraderSystemInvNum: str\n
        """
        self.do("OpenInvoiceWithFreeCustomerData", 'CompanyName', CompanyName, 'ClientPINnum', ClientPINnum, 'HeadQuarters', HeadQuarters, 'Address', Address, 'PostalCodeAndCity', PostalCodeAndCity, 'ExemptionNum', ExemptionNum, 'TraderSystemInvNum', TraderSystemInvNum)

    def OpenReceipt(self, OptionReceiptFormat, TraderSystemInvNum):
        """
        Opens a fiscal receipt assigned to the specified operator number and operator password, parameters for receipt format and VAT type.\n
        :param OptionReceiptFormat: 1 symbol with value: 
         - '1' - Detailed 
         - '0' - Brief\n
        :type OptionReceiptFormat: Enums.OptionReceiptFormat\n
        :param TraderSystemInvNum: 15 symbols for trader system invoice number\n
        :type TraderSystemInvNum: str\n
        """
        self.do("OpenReceipt", 'OptionReceiptFormat', OptionReceiptFormat, 'TraderSystemInvNum', TraderSystemInvNum)

    def ProgHScode(self, HS_Number, HS_Code, HS_Name, OptionTaxable, MesureUnit, VAT_Rate):
        """
        Programs HS code at a given position (HS number in order).\n
        :param HS_Number: 4 symbols for HS number in order in format ####\n
        :type HS_Number: float\n
        :param HS_Code: 10 symbols for HS code\n
        :type HS_Code: str\n
        :param HS_Name: 20 symbols for name of HS group\n
        :type HS_Name: str\n
        :param OptionTaxable: 1 symbol for parameter: 
        - '1' - Exempted 
        - '0' - Taxable\n
        :type OptionTaxable: Enums.OptionTaxable\n
        :param MesureUnit: 3 symbols for mesure unit of item's code\n
        :type MesureUnit: str\n
        :param VAT_Rate: Value of VAT rate from 2 to 5 symbols with format ##.##\n
        :type VAT_Rate: float\n
        """
        self.do("ProgHScode", 'HS_Number', HS_Number, 'HS_Code', HS_Code, 'HS_Name', HS_Name, 'OptionTaxable', OptionTaxable, 'MesureUnit', MesureUnit, 'VAT_Rate', VAT_Rate)

    def ProgVATrates(self, Password, VATrateA, VATrateB, VATrateC, VATrateD, VATrateE):
        """
        Stores a block containing the values of the VAT rates into the CU\n
        :param Password: 6-symbols string\n
        :type Password: str\n
        :param VATrateA: Value of VAT rate A from 2 to 6 symbols with format ##.##\n
        :type VATrateA: float\n
        :param VATrateB: Value of VAT rate B from 2 to 6 symbols with format ##.##\n
        :type VATrateB: float\n
        :param VATrateC: Value of VAT rate C from 2 to 6 symbols with format ##.##\n
        :type VATrateC: float\n
        :param VATrateD: Value of VAT rate D from 2 to 6 symbols with format ##.##\n
        :type VATrateD: float\n
        :param VATrateE: Value of VAT rate E from 2 to 6 symbols with format ##.##\n
        :type VATrateE: float\n
        """
        self.do("ProgVATrates", 'Password', Password, 'VATrateA', VATrateA, 'VATrateB', VATrateB, 'VATrateC', VATrateC, 'VATrateD', VATrateD, 'VATrateE', VATrateE)

    def RawRead(self, Count, EndChar):
        """
         Reads raw bytes from FP.\n
        :param Count: How many bytes to read if EndChar is not specified\n
        :type Count: float\n
        :param EndChar: The character marking the end of the data. If present Count parameter is ignored.\n
        :type EndChar: str\n
        :rtype: bytearray
        """
        return self.do("RawRead", 'Count', Count, 'EndChar', EndChar)

    def RawWrite(self, Bytes):
        """
         Writes raw bytes to FP \n
        :param Bytes: The bytes in BASE64 ecoded string to be written to FP\n
        :type Bytes: bytearray\n
        """
        self.do("RawWrite", 'Bytes', Bytes)

    def ReadCUnumbers(self):
        """
        Provides information about the manufacturing number of the CU and PIN number.\n
        """
        return __CUnumbersRes__(*self.do("ReadCUnumbers"))

    def ReadCurrentReceiptInfo(self):
        """
        Read the current status of the receipt.\n
        """
        return __CurrentReceiptInfoRes__(*self.do("ReadCurrentReceiptInfo"))

    def ReadDailyAmountsByVAT(self):
        """
        Provides information about the accumulated amounts and refunded amounts by VAT class in case that CU regularly informs about the Z report(7C)\n
        """
        return __DailyAmountsByVATRes__(*self.do("ReadDailyAmountsByVAT"))

    def ReadDateTime(self):
        """
        Provides information about the current date and time.\n
        :rtype: datetime
        """
        return self.do("ReadDateTime")

    def ReadDeviceModuleSupport(self):
        """
        FlagsModule is a char with bits representing modules supported by the device.\n
        """
        return __DeviceModuleSupportRes__(*self.do("ReadDeviceModuleSupport"))

    def ReadDeviceModuleSupportByFirmware(self):
        """
        FlagsModule is a char with bits representing modules supported by the firmware\n
        """
        return __DeviceModuleSupportByFirmwareRes__(*self.do("ReadDeviceModuleSupportByFirmware"))

    def ReadDeviceTCP_Addresses(self, OptionAddressType):
        """
        Provides information about device's network IP address, subnet mask, gateway address, DNS address.\n
        :param OptionAddressType: 1 symbol with value: 
         - '2' - IP address 
         - '3' - Subnet Mask 
         - '4' - Gateway address 
         - '5' - DNS address\n
        :type OptionAddressType: Enums.OptionAddressType\n
        """
        return __DeviceTCP_AddressesRes__(*self.do("ReadDeviceTCP_Addresses", 'OptionAddressType', OptionAddressType))

    def ReadDHCP_Status(self):
        """
        Provides information about device's DHCP status\n
        :rtype: Enums.OptionDHCPEnabled
        """
        return self.do("ReadDHCP_Status")

    def ReadDiagnostics(self):
        """
        Provides information about documents sending functions .\n
        """
        return __DiagnosticsRes__(*self.do("ReadDiagnostics"))

    def ReadEJ(self, OptionReadEJStorage):
        """
        Read whole Electronic Journal report from beginning to the end.\n
        :param OptionReadEJStorage: 2 symbols for destination: 
         - 'J0' - Reading to PC 
         - 'JY' - Reading to PC for JSON\n
        :type OptionReadEJStorage: Enums.OptionReadEJStorage\n
        """
        self.do("ReadEJ", 'OptionReadEJStorage', OptionReadEJStorage)

    def ReadEJByDate(self, OptionReadEJStorage, StartRepFromDate, EndRepFromDate):
        """
        Read Electronic Journal Report initial date to report end date.\n
        :param OptionReadEJStorage: 2 symbols for destination: 
         - 'J0' - Reading to PC 
         - 'JY' - Reading to PC for JSON\n
        :type OptionReadEJStorage: Enums.OptionReadEJStorage\n
        :param StartRepFromDate: 6 symbols for initial date in the DDMMYY format\n
        :type StartRepFromDate: datetime\n
        :param EndRepFromDate: 6 symbols for final date in the DDMMYY format\n
        :type EndRepFromDate: datetime\n
        """
        self.do("ReadEJByDate", 'OptionReadEJStorage', OptionReadEJStorage, 'StartRepFromDate', StartRepFromDate, 'EndRepFromDate', EndRepFromDate)

    def ReadEODAmounts(self):
        """
        Provides information about the accumulated EOD turnover and VAT\n
        """
        return __EODAmountsRes__(*self.do("ReadEODAmounts"))

    def ReadGPRS_APN(self):
        """
        Provides information about device's GRPS APN.\n
        """
        return __GPRS_APNRes__(*self.do("ReadGPRS_APN"))

    def ReadGPRS_AuthenticationType(self):
        """
        Read GPRS APN authentication type\n
        :rtype: Enums.OptionAuthenticationType
        """
        return self.do("ReadGPRS_AuthenticationType")

    def ReadGPRS_Password(self):
        """
        Provides information about device's GPRS password.\n
        """
        return __GPRS_PasswordRes__(*self.do("ReadGPRS_Password"))

    def ReadGPRS_Username(self):
        """
        Providing information about device's GPRS user name.\n
        """
        return __GPRS_UsernameRes__(*self.do("ReadGPRS_Username"))

    def ReadHScode(self, HS_Number):
        """
        Programs HS code at a given position (HS number in order).\n
        :param HS_Number: 4 symbols for HS number in order in format ####\n
        :type HS_Number: float\n
        """
        return __HScodeRes__(*self.do("ReadHScode", 'HS_Number', HS_Number))

    def ReadHScodeNumber(self):
        """
        Read the number of HS codes.\n
        :rtype: float
        """
        return self.do("ReadHScodeNumber")

    def ReadHTTPS_Server(self):
        """
        Providing information about server HTTPS address.\n
        """
        return __HTTPS_ServerRes__(*self.do("ReadHTTPS_Server"))

    def ReadInfoFromLastServerCommunication(self, OptionServerResponse, OptionTransactionType):
        """
        Provide information from the last communication with the server.\n
        :param OptionServerResponse: 1 symbol with value 
        - 'R' - At send receipt 
        - 'Z' - At send EOD\n
        :type OptionServerResponse: Enums.OptionServerResponse\n
        :param OptionTransactionType: 1 symbol with value 
        - 'c' - Error Code 
        - 'm' - Error Message 
        - 's' - Status 
        - 'e' - Exception Message\n
        :type OptionTransactionType: Enums.OptionTransactionType\n
        """
        return __InfoFromLastServerCommunicationRes__(*self.do("ReadInfoFromLastServerCommunication", 'OptionServerResponse', OptionServerResponse, 'OptionTransactionType', OptionTransactionType))

    def ReadInvoice_Threshold(self):
        """
        Read invoice threshold count\n
        :rtype: float
        """
        return self.do("ReadInvoice_Threshold")

    def ReadLastAndTotalReceiptNum(self):
        """
        Provides information about the number of the last issued receipt.\n
        """
        return __LastAndTotalReceiptNumRes__(*self.do("ReadLastAndTotalReceiptNum"))

    def ReadNTP_Address(self):
        """
        Provides information about device's NTP address.\n
        """
        return __NTP_AddressRes__(*self.do("ReadNTP_Address"))

    def ReadOrStoreInvoiceCopy(self, OptionInvoiceCopy, CUInvoiceNum):
        """
        Read/Store Invoice receipt copy to External USB Flash memory, External SD card.\n
        :param OptionInvoiceCopy: 2 symbols for destination: 
         - 'J0' - Reading  
         - 'J2' - Storage in External USB Flash memory. 
         - 'J4' - Storage in External SD card memory\n
        :type OptionInvoiceCopy: Enums.OptionInvoiceCopy\n
        :param CUInvoiceNum: 10 symbols for Invoice receipt Number.\n
        :type CUInvoiceNum: str\n
        """
        self.do("ReadOrStoreInvoiceCopy", 'OptionInvoiceCopy', OptionInvoiceCopy, 'CUInvoiceNum', CUInvoiceNum)

    def ReadServer_UsedComModule(self):
        """
        Read device communication usage with server\n
        :rtype: Enums.OptionModule
        """
        return self.do("ReadServer_UsedComModule")

    def ReadSpecificMessage(self, MessageNum):
        """
        Reads specific message number\n
        :param MessageNum: 2 symbols for total number of messages\n
        :type MessageNum: str\n
        """
        return __SpecificMessageRes__(*self.do("ReadSpecificMessage", 'MessageNum', MessageNum))

    def ReadStatus(self):
        """
        Provides detailed 6-byte information about the current status of the CU.\n
        """
        return __StatusRes__(*self.do("ReadStatus"))

    def ReadTCP_AutoStartStatus(self):
        """
        Provides information about if the TCP connection autostart when the device enter in Line/Sale mode.\n
        :rtype: Enums.OptionTCPAutoStart
        """
        return self.do("ReadTCP_AutoStartStatus")

    def ReadTCP_MACAddress(self):
        """
        Provides information about device's MAC address.\n
        :rtype: str
        """
        return self.do("ReadTCP_MACAddress")

    def ReadTCP_Password(self):
        """
        Provides information about device's TCP password.\n
        """
        return __TCP_PasswordRes__(*self.do("ReadTCP_Password"))

    def ReadTCP_UsedModule(self):
        """
        Provides information about which module the device is in use: LAN or WiFi module. This information can be provided if the device has mounted both modules.\n
        :rtype: Enums.OptionUsedModule
        """
        return self.do("ReadTCP_UsedModule")

    def ReadTimeThreshold_Minutes(self):
        """
        Read time threshold minutes\n
        :rtype: float
        """
        return self.do("ReadTimeThreshold_Minutes")

    def ReadTotalMessagesCount(self):
        """
        Reads all messages from log\n
        :rtype: str
        """
        return self.do("ReadTotalMessagesCount")

    def ReadVATrates(self):
        """
        Provides information about the current VAT rates (the last value stored in FM).\n
        """
        return __VATratesRes__(*self.do("ReadVATrates"))

    def ReadVersion(self):
        """
        Provides information about the device version.\n
        :rtype: str
        """
        return self.do("ReadVersion")

    def ReadWiFi_NetworkName(self):
        """
        Provides information about WiFi network name where the device is connected.\n
        """
        return __WiFi_NetworkNameRes__(*self.do("ReadWiFi_NetworkName"))

    def ReadWiFi_Password(self):
        """
        Providing information about WiFi password where the device is connected.\n
        """
        return __WiFi_PasswordRes__(*self.do("ReadWiFi_Password"))

    def Read_IdleTimeout(self):
        """
        Provides information about device's idle timeout. This timeout is seconds in which the connection will be closed when there is an inactivity. This information is available if the device has LAN or WiFi. Maximal value - 7200, minimal value 1. 0 is for never close the connection.\n
        :rtype: float
        """
        return self.do("Read_IdleTimeout")

    def SaveNetworkSettings(self):
        """
        After every change on Idle timeout, LAN/WiFi/GPRS usage, LAN/WiFi/TCP/GPRS password or TCP auto start networks settings this Save command needs to be execute.\n
        """
        self.do("SaveNetworkSettings")

    def ScanAndPrintWifiNetworks(self):
        """
        Scan and print available wifi networks\n
        """
        self.do("ScanAndPrintWifiNetworks")

    def ScanWiFiNetworks(self):
        """
        The device scan out the list of available WiFi networks.\n
        """
        self.do("ScanWiFiNetworks")

    def SellPLUfromExtDB(self, NamePLU, OptionVATClass, Price, MeasureUnit, HSCode, HSName, VATGrRate, Quantity=None, DiscAddP=None):
        """
        Register the sell (for correction use minus sign in the price field) of article with specified name, price, quantity, VAT class and/or discount/addition on the transaction.\n
        :param NamePLU: 36 symbols for article's name\n
        :type NamePLU: str\n
        :param OptionVATClass: 1 symbol for article's VAT class with optional values:" 
         - 'A' - VAT Class A 
         - 'B' - VAT Class B 
         - 'C' - VAT Class C 
         - 'D' - VAT Class D 
         - 'E' - VAT Class E\n
        :type OptionVATClass: Enums.OptionVATClass\n
        :param Price: Up to 10 symbols for article's price\n
        :type Price: float\n
        :param MeasureUnit: 3 symbols for measure unit\n
        :type MeasureUnit: str\n
        :param HSCode: 10 symbols for HS Code in format XXXX.XX.XX\n
        :type HSCode: str\n
        :param HSName: 20 symbols for HS Name\n
        :type HSName: str\n
        :param VATGrRate: Up to 5 symbols for programmable VAT rate\n
        :type VATGrRate: float\n
        :param Quantity: 1 to 10 symbols for quantity\n
        :type Quantity: float\n
        :param DiscAddP: 1 to 7 for percentage of discount/addition\n
        :type DiscAddP: float\n
        """
        self.do("SellPLUfromExtDB", 'NamePLU', NamePLU, 'OptionVATClass', OptionVATClass, 'Price', Price, 'MeasureUnit', MeasureUnit, 'HSCode', HSCode, 'HSName', HSName, 'VATGrRate', VATGrRate, 'Quantity', Quantity, 'DiscAddP', DiscAddP)

    def SellPLUfromExtDB_HS(self, NamePLU, Price, HSCode, Quantity=None, DiscAddP=None):
        """
        Register the sell (for correction use minus sign in the price field) of article with specified name, price, quantity, VAT class and/or discount/addition on the transaction.\n
        :param NamePLU: 36 symbols for article's name\n
        :type NamePLU: str\n
        :param Price: Up to 10 symbols for article's price\n
        :type Price: float\n
        :param HSCode: 10 symbols for HS Code in format XXXX.XX.XX\n
        :type HSCode: str\n
        :param Quantity: 1 to 10 symbols for quantity\n
        :type Quantity: float\n
        :param DiscAddP: 1 to 7 for percentage of discount/addition\n
        :type DiscAddP: float\n
        """
        self.do("SellPLUfromExtDB_HS", 'NamePLU', NamePLU, 'Price', Price, 'HSCode', HSCode, 'Quantity', Quantity, 'DiscAddP', DiscAddP)

    def SetDateTime(self, DateTime):
        """
        Sets the date and time and current values.\n
        :param DateTime: Date Time parameter in format: DD-MM-YY HH:MM\n
        :type DateTime: datetime\n
        """
        self.do("SetDateTime", 'DateTime', DateTime)

    def SetDeviceNTP_Address(self, AddressLen, NTPAddress):
        """
        Program device's NTP address . To apply use - SaveNetworkSettings()\n
        :param AddressLen: Up to 3 symbols for the address length\n
        :type AddressLen: float\n
        :param NTPAddress: 50 symbols for the device's NTP address\n
        :type NTPAddress: str\n
        """
        self.do("SetDeviceNTP_Address", 'AddressLen', AddressLen, 'NTPAddress', NTPAddress)

    def SetDeviceTCP_Addresses(self, OptionAddressType, DeviceAddress):
        """
        Program device's network IP address, subnet mask, gateway address, DNS address. To apply use -SaveNetworkSettings()\n
        :param OptionAddressType: 1 symbol with value: 
         - '2' - IP address 
         - '3' - Subnet Mask 
         - '4' - Gateway address 
         - '5' - DNS address\n
        :type OptionAddressType: Enums.OptionAddressType\n
        :param DeviceAddress: 15 symbols for the selected address\n
        :type DeviceAddress: str\n
        """
        self.do("SetDeviceTCP_Addresses", 'OptionAddressType', OptionAddressType, 'DeviceAddress', DeviceAddress)

    def SetDeviceTCP_MACAddress(self, MACAddress):
        """
        Program device's MAC address . To apply use - SaveNetworkSettings()\n
        :param MACAddress: 12 symbols for the MAC address\n
        :type MACAddress: str\n
        """
        self.do("SetDeviceTCP_MACAddress", 'MACAddress', MACAddress)

    def SetDHCP_Enabled(self, OptionDHCPEnabled):
        """
        Program device's TCP network DHCP enabled or disabled. To apply use -SaveNetworkSettings()\n
        :param OptionDHCPEnabled: 1 symbol with value: 
         - '0' - Disabled 
         - '1' - Enabled\n
        :type OptionDHCPEnabled: Enums.OptionDHCPEnabled\n
        """
        self.do("SetDHCP_Enabled", 'OptionDHCPEnabled', OptionDHCPEnabled)

    def SetGPRS_APN(self, gprsAPNlength, APN):
        """
        Program device's GPRS APN. To apply use -SaveNetworkSettings()\n
        :param gprsAPNlength: Up to 3 symbols for the APN len\n
        :type gprsAPNlength: float\n
        :param APN: Up to 100 symbols for the device's GPRS APN\n
        :type APN: str\n
        """
        self.do("SetGPRS_APN", 'gprsAPNlength', gprsAPNlength, 'APN', APN)

    def SetGPRS_AuthenticationType(self, OptionAuthenticationType):
        """
        Programs GPRS APN authentication type\n
        :param OptionAuthenticationType: 1 symbol with value: 
        - '0' - None 
        - '1' - PAP 
        - '2' - CHAP 
        - '3' - PAP or CHAP\n
        :type OptionAuthenticationType: Enums.OptionAuthenticationType\n
        """
        self.do("SetGPRS_AuthenticationType", 'OptionAuthenticationType', OptionAuthenticationType)

    def SetGPRS_Password(self, PassLength, Password):
        """
        Program device's GPRS password. To apply use - SaveNetworkSettings()\n
        :param PassLength: Up to 3 symbols for the GPRS password len\n
        :type PassLength: float\n
        :param Password: Up to 100 symbols for the device's GPRS password\n
        :type Password: str\n
        """
        self.do("SetGPRS_Password", 'PassLength', PassLength, 'Password', Password)

    def SetHTTPS_Address(self, ParamLength, Address):
        """
        Programs server HTTPS address.\n
        :param ParamLength: Up to 3 symbols for parameter length\n
        :type ParamLength: float\n
        :param Address: 50 symbols for address\n
        :type Address: str\n
        """
        self.do("SetHTTPS_Address", 'ParamLength', ParamLength, 'Address', Address)

    def SetIdle_Timeout(self, IdleTimeout):
        """
        Program device's idle timeout setting. Set timeout for closing the connection if there is an inactivity. Maximal value - 7200, minimal value 1. 0 is for never close the connection. This option can be used only if the device has LAN or WiFi. To apply use - SaveNetworkSettings()\n
        :param IdleTimeout: 4 symbols for Idle timeout in format ####\n
        :type IdleTimeout: float\n
        """
        self.do("SetIdle_Timeout", 'IdleTimeout', IdleTimeout)

    def SetInvoice_ThresholdCount(self, Value):
        """
        Programs invoice threshold count\n
        :param Value: Up to 5 symbols for value\n
        :type Value: float\n
        """
        self.do("SetInvoice_ThresholdCount", 'Value', Value)

    def SetPINnumber(self, Password, PINnum):
        """
        Stores PIN number in operative memory.\n
        :param Password: 6-symbols string\n
        :type Password: str\n
        :param PINnum: 11 symbols for PIN registration number\n
        :type PINnum: str\n
        """
        self.do("SetPINnumber", 'Password', Password, 'PINnum', PINnum)

    def SetSerialNum(self, Password, SerialNum):
        """
        Stores the Manufacturing number into the operative memory.\n
        :param Password: 6-symbols string\n
        :type Password: str\n
        :param SerialNum: 20 symbols Manufacturing number\n
        :type SerialNum: str\n
        """
        self.do("SetSerialNum", 'Password', Password, 'SerialNum', SerialNum)

    def SetServer_UsedComModule(self, OptionModule):
        """
        Program device used to talk with the server . To apply use - SaveNetworkSettings()\n
        :param OptionModule: 1 symbol with value: 
         - '0' - GSM 
         - '1' - LAN/WiFi\n
        :type OptionModule: Enums.OptionModule\n
        """
        self.do("SetServer_UsedComModule", 'OptionModule', OptionModule)

    def SetTCP_ActiveModule(self, OptionUsedModule):
        """
        Selects the active communication module - LAN or WiFi. This option can be set only if the device has both modules at the same time. To apply use - SaveNetworkSettings()\n
        :param OptionUsedModule: 1 symbol with value: 
         - '1' - LAN module 
         - '2' - WiFi module\n
        :type OptionUsedModule: Enums.OptionUsedModule\n
        """
        self.do("SetTCP_ActiveModule", 'OptionUsedModule', OptionUsedModule)

    def SetTCP_AutoStart(self, OptionTCPAutoStart):
        """
        Program device's autostart TCP conection in sale/line mode. To apply use -SaveNetworkSettings()\n
        :param OptionTCPAutoStart: 1 symbol with value: 
         - '0' - No 
         - '1' - Yes\n
        :type OptionTCPAutoStart: Enums.OptionTCPAutoStart\n
        """
        self.do("SetTCP_AutoStart", 'OptionTCPAutoStart', OptionTCPAutoStart)

    def SetTCP_Password(self, PassLength, Password):
        """
        Program device's TCP password. To apply use - SaveNetworkSettings()\n
        :param PassLength: Up to 3 symbols for the password len\n
        :type PassLength: float\n
        :param Password: Up to 100 symbols for the TCP password\n
        :type Password: str\n
        """
        self.do("SetTCP_Password", 'PassLength', PassLength, 'Password', Password)

    def SetTime_ThresholdMinutes(self, Value):
        """
        Programs time threshold minutes\n
        :param Value: Up to 5 symbols for value\n
        :type Value: float\n
        """
        self.do("SetTime_ThresholdMinutes", 'Value', Value)

    def SetWiFi_NetworkName(self, WiFiNameLength, WiFiNetworkName):
        """
        Program device's TCP WiFi network name where it will be connected. To apply use -SaveNetworkSettings()\n
        :param WiFiNameLength: Up to 3 symbols for the WiFi network name len\n
        :type WiFiNameLength: float\n
        :param WiFiNetworkName: Up to 100 symbols for the device's WiFi ssid network name\n
        :type WiFiNetworkName: str\n
        """
        self.do("SetWiFi_NetworkName", 'WiFiNameLength', WiFiNameLength, 'WiFiNetworkName', WiFiNetworkName)

    def SetWiFi_Password(self, PassLength, Password):
        """
        Program device's TCP WiFi password where it will be connected. To apply use -SaveNetworkSettings()\n
        :param PassLength: Up to 3 symbols for the WiFi password len\n
        :type PassLength: float\n
        :param Password: Up to 100 symbols for the device's WiFi password\n
        :type Password: str\n
        """
        self.do("SetWiFi_Password", 'PassLength', PassLength, 'Password', Password)

    def SoftwareReset(self, Password):
        """
        Restore default parameters of the device.\n
        :param Password: 6-symbols string\n
        :type Password: str\n
        """
        self.do("SoftwareReset", 'Password', Password)

    def StartGPRStest(self):
        """
        Start GPRS test on the device the result\n
        """
        self.do("StartGPRStest")

    def StartLANtest(self):
        """
        Start LAN test on the device the result\n
        """
        self.do("StartLANtest")

    def StartWiFiTest(self):
        """
        Start WiFi test on the device the result\n
        """
        self.do("StartWiFiTest")

    def StoreEJ(self, OptionReportStorage):
        """
        Store whole Electronic Journal report to External USB Flash memory, External SD card.\n
        :param OptionReportStorage: 2 symbols for destination: 
         - 'J2' - Storage in External USB Flash memory 
         - 'J4' - Storage in External SD card memory 
         - 'Jx' - Storage in External USB Flash memory for JSON 
         - 'JX' - Storage in External SD card memory for JSON\n
        :type OptionReportStorage: Enums.OptionReportStorage\n
        """
        self.do("StoreEJ", 'OptionReportStorage', OptionReportStorage)

    def StoreEJByDate(self, OptionReportStorage, StartRepFromDate, EndRepFromDate):
        """
        Store Electronic Journal Report from report from date to date to External USB Flash memory, External SD card.\n
        :param OptionReportStorage: 2 symbols for destination: 
         - 'J2' - Storage in External USB Flash memory 
         - 'J4' - Storage in External SD card memory 
         - 'Jx' - Storage in External USB Flash memory for JSON 
         - 'JX' - Storage in External SD card memory for JSON\n
        :type OptionReportStorage: Enums.OptionReportStorage\n
        :param StartRepFromDate: 6 symbols for initial date in the DDMMYY format\n
        :type StartRepFromDate: datetime\n
        :param EndRepFromDate: 6 symbols for final date in the DDMMYY format\n
        :type EndRepFromDate: datetime\n
        """
        self.do("StoreEJByDate", 'OptionReportStorage', OptionReportStorage, 'StartRepFromDate', StartRepFromDate, 'EndRepFromDate', EndRepFromDate)

    def Subtotal(self, OptionDisplay, DiscAddV=None, DiscAddP=None):
        """
        Calculate the subtotal amount with printing and display visualization options. Provide information about values of the calculated amounts. If a percent or value discount/addition has been specified the subtotal and the discount/addition value will be printed regardless the parameter for printing.\n
        :param OptionDisplay: 1 symbol with value: 
         - '1' - Yes 
         - '0' - No\n
        :type OptionDisplay: Enums.OptionDisplay\n
        :param DiscAddV: Up to 8 symbols for the value of the 
        discount/addition. Use minus sign '-' for discount\n
        :type DiscAddV: float\n
        :param DiscAddP: Up to 7 symbols for the percentage value of the 
        discount/addition. Use minus sign '-' for discount\n
        :type DiscAddP: float\n
        :rtype: float
        """
        return self.do("Subtotal", 'OptionDisplay', OptionDisplay, 'DiscAddV', DiscAddV, 'DiscAddP', DiscAddP)


class __CloseReceiptRes__:
    """
    :param InvoiceNum: 19 symbols for CU invoice number\n
    :type InvoiceNum: str\n
    :param QRcode: 128 symbols for QR code\n
    :type QRcode: str\n
    """
    def __init__(self, InvoiceNum, QRcode):
        self.InvoiceNum = InvoiceNum
        self.QRcode = QRcode


class __CUnumbersRes__:
    """
    :param SerialNumber: 20 symbols for individual number of the CU\n
    :type SerialNumber: str\n
    :param PINnumber: 11 symbols for pin number\n
    :type PINnumber: str\n
    """
    def __init__(self, SerialNumber, PINnumber):
        self.SerialNumber = SerialNumber
        self.PINnumber = PINnumber


class __CurrentReceiptInfoRes__:
    """
    :param OptionIsReceiptOpened: 1 symbol with value: 
     - '0' - No 
     - '1' - Yes\n
    :type OptionIsReceiptOpened: Enums.OptionIsReceiptOpened\n
    :param SalesNumber: 3 symbols for number of sales\n
    :type SalesNumber: str\n
    :param SubtotalAmountVATGA: Up to 11 symbols for subtotal by VAT group A\n
    :type SubtotalAmountVATGA: float\n
    :param SubtotalAmountVATGB: Up to 11 symbols for subtotal by VAT group B\n
    :type SubtotalAmountVATGB: float\n
    :param SubtotalAmountVATGC: Up to 11 symbols for subtotal by VAT group C\n
    :type SubtotalAmountVATGC: float\n
    :param SubtotalAmountVATGD: Up to 11 symbols for subtotal by VAT group D\n
    :type SubtotalAmountVATGD: float\n
    :param SubtotalAmountVATGE: Up to 11 symbols for subtotal by VAT group E\n
    :type SubtotalAmountVATGE: float\n
    :param OptionReceiptFormat: (Format) 1 symbol with value: 
     - '1' - Detailed 
     - '0' - Brief\n
    :type OptionReceiptFormat: Enums.OptionReceiptFormat\n
    :param OptionClientReceipt: 1 symbol with value: 
     - '1' - invoice (client) receipt 
     - '0' - standard receipt\n
    :type OptionClientReceipt: Enums.OptionClientReceipt\n
    :param OptionPowerDownInReceipt: 1 symbol with value: 
    - '0' - No 
    - '1' - Yes\n
    :type OptionPowerDownInReceipt: Enums.OptionPowerDownInReceipt\n
    :param reserved5: Up to 11 symbols\n
    :type reserved5: float\n
    """
    def __init__(self, OptionIsReceiptOpened, SalesNumber, SubtotalAmountVATGA, SubtotalAmountVATGB, SubtotalAmountVATGC, SubtotalAmountVATGD, SubtotalAmountVATGE, OptionReceiptFormat, OptionClientReceipt, OptionPowerDownInReceipt, reserved5):
        self.OptionIsReceiptOpened = OptionIsReceiptOpened
        self.SalesNumber = SalesNumber
        self.SubtotalAmountVATGA = SubtotalAmountVATGA
        self.SubtotalAmountVATGB = SubtotalAmountVATGB
        self.SubtotalAmountVATGC = SubtotalAmountVATGC
        self.SubtotalAmountVATGD = SubtotalAmountVATGD
        self.SubtotalAmountVATGE = SubtotalAmountVATGE
        self.OptionReceiptFormat = OptionReceiptFormat
        self.OptionClientReceipt = OptionClientReceipt
        self.OptionPowerDownInReceipt = OptionPowerDownInReceipt
        self.reserved5 = reserved5


class __DailyAmountsByVATRes__:
    """
    :param SaleAmountVATGrA: Up to 13 symbols for the amount accumulated in the VAT group A\n
    :type SaleAmountVATGrA: float\n
    :param SaleAmountVATGrB: Up to 13 symbols for the amount accumulated in the VAT group B\n
    :type SaleAmountVATGrB: float\n
    :param SaleAmountVATGrC: Up to 13 symbols for the amount accumulated in the VAT group C\n
    :type SaleAmountVATGrC: float\n
    :param SaleAmountVATGrD: Up to 13 symbols for the amount accumulated in the VAT group D\n
    :type SaleAmountVATGrD: float\n
    :param SaleAmountVATGrE: Up to 13 symbols for the amount accumulated in the VAT group E\n
    :type SaleAmountVATGrE: float\n
    :param TurnoverAmountVAT: Up to 13 symbols for the turnover amount for VATs A, B, C, D\n
    :type TurnoverAmountVAT: float\n
    :param RefundAmountVATGrA: Up to 13 symbols for the refund amount accumulated in the VAT group A\n
    :type RefundAmountVATGrA: float\n
    :param RefundAmountVATGrB: Up to 13 symbols for the refund amount accumulated in the VAT group B\n
    :type RefundAmountVATGrB: float\n
    :param RefundAmountVATGrC: Up to 13 symbols for the refund amount accumulated in the VAT group C\n
    :type RefundAmountVATGrC: float\n
    :param RefundAmountVATGrD: Up to 13 symbols for the refund amount accumulated in the VAT group D\n
    :type RefundAmountVATGrD: float\n
    :param RefundAmountVATGrE: Up to 13 symbols for the refund amount accumulated in the VAT group E\n
    :type RefundAmountVATGrE: float\n
    :param TurnoverRefAmountVAT: Up to 13 symbols for the refund turnover amount for VATs A, B, C, D\n
    :type TurnoverRefAmountVAT: float\n
    """
    def __init__(self, SaleAmountVATGrA, SaleAmountVATGrB, SaleAmountVATGrC, SaleAmountVATGrD, SaleAmountVATGrE, TurnoverAmountVAT, RefundAmountVATGrA, RefundAmountVATGrB, RefundAmountVATGrC, RefundAmountVATGrD, RefundAmountVATGrE, TurnoverRefAmountVAT):
        self.SaleAmountVATGrA = SaleAmountVATGrA
        self.SaleAmountVATGrB = SaleAmountVATGrB
        self.SaleAmountVATGrC = SaleAmountVATGrC
        self.SaleAmountVATGrD = SaleAmountVATGrD
        self.SaleAmountVATGrE = SaleAmountVATGrE
        self.TurnoverAmountVAT = TurnoverAmountVAT
        self.RefundAmountVATGrA = RefundAmountVATGrA
        self.RefundAmountVATGrB = RefundAmountVATGrB
        self.RefundAmountVATGrC = RefundAmountVATGrC
        self.RefundAmountVATGrD = RefundAmountVATGrD
        self.RefundAmountVATGrE = RefundAmountVATGrE
        self.TurnoverRefAmountVAT = TurnoverRefAmountVAT


class __DeviceModuleSupportRes__:
    """
    :param OptionLAN: 1 symbol for LAN suppor 
    - '0' - No 
     - '1' - Yes\n
    :type OptionLAN: Enums.OptionLAN\n
    :param OptionWiFi: 1 symbol for WiFi support 
    - '0' - No 
     - '1' - Yes\n
    :type OptionWiFi: Enums.OptionWiFi\n
    :param OptionGPRS: 1 symbol for GPRS support 
    - '0' - No 
     - '1' - Yes 
    BT (Bluetooth) 1 symbol for Bluetooth support 
    - '0' - No 
     - '1' - Yes\n
    :type OptionGPRS: Enums.OptionGPRS\n
    :param OptionBT: (Bluetooth) 1 symbol for Bluetooth support 
    - '0' - No 
     - '1' - Yes\n
    :type OptionBT: Enums.OptionBT\n
    """
    def __init__(self, OptionLAN, OptionWiFi, OptionGPRS, OptionBT):
        self.OptionLAN = OptionLAN
        self.OptionWiFi = OptionWiFi
        self.OptionGPRS = OptionGPRS
        self.OptionBT = OptionBT


class __DeviceModuleSupportByFirmwareRes__:
    """
    :param OptionLAN: 1 symbol for LAN suppor 
    - '0' - No 
     - '1' - Yes\n
    :type OptionLAN: Enums.OptionLAN\n
    :param OptionWiFi: 1 symbol for WiFi support 
    - '0' - No 
     - '1' - Yes\n
    :type OptionWiFi: Enums.OptionWiFi\n
    :param OptionGPRS: 1 symbol for GPRS support 
    - '0' - No 
     - '1' - Yes 
    BT (Bluetooth) 1 symbol for Bluetooth support 
    - '0' - No 
     - '1' - Yes\n
    :type OptionGPRS: Enums.OptionGPRS\n
    :param OptionBT: (Bluetooth) 1 symbol for Bluetooth support 
    - '0' - No 
     - '1' - Yes\n
    :type OptionBT: Enums.OptionBT\n
    """
    def __init__(self, OptionLAN, OptionWiFi, OptionGPRS, OptionBT):
        self.OptionLAN = OptionLAN
        self.OptionWiFi = OptionWiFi
        self.OptionGPRS = OptionGPRS
        self.OptionBT = OptionBT


class __DeviceTCP_AddressesRes__:
    """
    :param OptionAddressType: (Address type) 1 symbol with value: 
     - '2' - IP address 
     - '3' - Subnet Mask 
     - '4' - Gateway address 
     - '5' - DNS address\n
    :type OptionAddressType: Enums.OptionAddressType\n
    :param DeviceAddress: 15 symbols for the device's addresses\n
    :type DeviceAddress: str\n
    """
    def __init__(self, OptionAddressType, DeviceAddress):
        self.OptionAddressType = OptionAddressType
        self.DeviceAddress = DeviceAddress


class __DiagnosticsRes__:
    """
    :param OptionDeviceType: 1 symbol for device type: 
     - '1' - A Type 
     - '2' - B Type\n
    :type OptionDeviceType: Enums.OptionDeviceType\n
    :param SDIdxPos: 10 symbols for current SD index position of last sent receipt\n
    :type SDIdxPos: str\n
    :param LastInvoiceCUNum: 19 symbols for number of last invoice according the CU\n
    :type LastInvoiceCUNum: str\n
    :param LastInvoiceDate: 6 symbols for last invoice date in the DDMMYY format\n
    :type LastInvoiceDate: str\n
    :param LastEODDate: 6 symbols for last sent EOD in the DDMMYY format\n
    :type LastEODDate: str\n
    :param InvoicesSent: 4 symbold for number of invoices sent for the current day\n
    :type InvoicesSent: str\n
    """
    def __init__(self, OptionDeviceType, SDIdxPos, LastInvoiceCUNum, LastInvoiceDate, LastEODDate, InvoicesSent):
        self.OptionDeviceType = OptionDeviceType
        self.SDIdxPos = SDIdxPos
        self.LastInvoiceCUNum = LastInvoiceCUNum
        self.LastInvoiceDate = LastInvoiceDate
        self.LastEODDate = LastEODDate
        self.InvoicesSent = InvoicesSent


class __EODAmountsRes__:
    """
    :param EOD_sale_turnover: Up to 13 symbols for the EOD sale turnover\n
    :type EOD_sale_turnover: float\n
    :param EOD_credit_turnover: Up to 13 symbols for the EOD credit turnover\n
    :type EOD_credit_turnover: float\n
    :param EOD_saleVAT: Up to 13 symbols for the EOD VAT from sales\n
    :type EOD_saleVAT: float\n
    :param EOD_creditVAT: Up to 13 symbols for the EOD VAT from credit invoices\n
    :type EOD_creditVAT: float\n
    """
    def __init__(self, EOD_sale_turnover, EOD_credit_turnover, EOD_saleVAT, EOD_creditVAT):
        self.EOD_sale_turnover = EOD_sale_turnover
        self.EOD_credit_turnover = EOD_credit_turnover
        self.EOD_saleVAT = EOD_saleVAT
        self.EOD_creditVAT = EOD_creditVAT


class __GPRS_APNRes__:
    """
    :param gprsAPNlength: Up to 3 symbols for the APN length\n
    :type gprsAPNlength: float\n
    :param APN: (APN) Up to 100 symbols for the device's GPRS APN\n
    :type APN: str\n
    """
    def __init__(self, gprsAPNlength, APN):
        self.gprsAPNlength = gprsAPNlength
        self.APN = APN


class __GPRS_PasswordRes__:
    """
    :param PassLength: Up to 3 symbols for the GPRS password length\n
    :type PassLength: float\n
    :param Password: Up to 100 symbols for the device's GPRS password\n
    :type Password: str\n
    """
    def __init__(self, PassLength, Password):
        self.PassLength = PassLength
        self.Password = Password


class __GPRS_UsernameRes__:
    """
    :param gprsUserNameLength: Up to 3 symbols for the GPRS username length\n
    :type gprsUserNameLength: float\n
    :param Username: Up to 100 symbols for the device's GPRS username\n
    :type Username: str\n
    """
    def __init__(self, gprsUserNameLength, Username):
        self.gprsUserNameLength = gprsUserNameLength
        self.Username = Username


class __HScodeRes__:
    """
    :param HS_Number: 4 symbols for HS number in order in format ####\n
    :type HS_Number: float\n
    :param HS_Code: 10 symbols for HS code\n
    :type HS_Code: str\n
    :param HS_Name: 20 symbols for name of HS group\n
    :type HS_Name: str\n
    :param OptionTaxable: 1 symbol for parameter: 
    - '1' - Exempted 
    - '0' - Taxable\n
    :type OptionTaxable: Enums.OptionTaxable\n
    :param MesureUnit: 3 symbols for mesure unit of item's code\n
    :type MesureUnit: str\n
    :param VAT_Rate: (VAT rate) Value of VAT rate from 2 to 5 symbols with format ##.##\n
    :type VAT_Rate: float\n
    """
    def __init__(self, HS_Number, HS_Code, HS_Name, OptionTaxable, MesureUnit, VAT_Rate):
        self.HS_Number = HS_Number
        self.HS_Code = HS_Code
        self.HS_Name = HS_Name
        self.OptionTaxable = OptionTaxable
        self.MesureUnit = MesureUnit
        self.VAT_Rate = VAT_Rate


class __HTTPS_ServerRes__:
    """
    :param ParamLength: Up to 3 symbols for parameter length\n
    :type ParamLength: float\n
    :param Address: 50 symbols for address\n
    :type Address: str\n
    """
    def __init__(self, ParamLength, Address):
        self.ParamLength = ParamLength
        self.Address = Address


class __InfoFromLastServerCommunicationRes__:
    """
    :param OptionServerResponse: 1 symbol with value 
    - 'R' - At send receipt 
    - 'Z' - At send EOD\n
    :type OptionServerResponse: Enums.OptionServerResponse\n
    :param OptionTransactionType: 1 symbol with value 
    - 'c' - Error Code 
    - 'm' - Error Message 
    - 's' - Status 
    - 'e' - Exception Message\n
    :type OptionTransactionType: Enums.OptionTransactionType\n
    :param Message: Up to 200 symbols for the message from the server\n
    :type Message: str\n
    """
    def __init__(self, OptionServerResponse, OptionTransactionType, Message):
        self.OptionServerResponse = OptionServerResponse
        self.OptionTransactionType = OptionTransactionType
        self.Message = Message


class __LastAndTotalReceiptNumRes__:
    """
    :param LastCUInvoiceNum: 19 symbols for the last number of invoice according the middleware, CU, 
    internal invoice counter\n
    :type LastCUInvoiceNum: str\n
    :param LastReceiptNum: 7 symbols for last receipt number in format #######\n
    :type LastReceiptNum: float\n
    """
    def __init__(self, LastCUInvoiceNum, LastReceiptNum):
        self.LastCUInvoiceNum = LastCUInvoiceNum
        self.LastReceiptNum = LastReceiptNum


class __NTP_AddressRes__:
    """
    :param AddressLen: Up to 3 symbols for the address length\n
    :type AddressLen: float\n
    :param NTPAddress: (NTP Address)50 symbols for the device's NTP address\n
    :type NTPAddress: str\n
    """
    def __init__(self, AddressLen, NTPAddress):
        self.AddressLen = AddressLen
        self.NTPAddress = NTPAddress


class __SpecificMessageRes__:
    """
    :param MessageNum: 2 symbols for total number of messages\n
    :type MessageNum: str\n
    :param DateTime: Date Time parameter\n
    :type DateTime: datetime\n
    :param Type: 1 symbol for type\n
    :type Type: str\n
    :param Code: 3 symbols for code\n
    :type Code: str\n
    :param MessageText: Up to 128 symbols for message text\n
    :type MessageText: str\n
    """
    def __init__(self, MessageNum, DateTime, Type, Code, MessageText):
        self.MessageNum = MessageNum
        self.DateTime = DateTime
        self.Type = Type
        self.Code = Code
        self.MessageText = MessageText


class __StatusRes__:
    """
    :param Power_down_in_opened_fiscal_receipt: Power down in opened fiscal receipt\n
    :type Power_down_in_opened_fiscal_receipt: bool\n
    :param DateTime_not_set: DateTime not set\n
    :type DateTime_not_set: bool\n
    :param DateTime_wrong: DateTime wrong\n
    :type DateTime_wrong: bool\n
    :param RAM_reset: RAM reset\n
    :type RAM_reset: bool\n
    :param Hardware_clock_error: Hardware clock error\n
    :type Hardware_clock_error: bool\n
    :param Reports_registers_Overflow: Reports registers Overflow\n
    :type Reports_registers_Overflow: bool\n
    :param Opened_Fiscal_Receipt: Opened Fiscal Receipt\n
    :type Opened_Fiscal_Receipt: bool\n
    :param Receipt_Invoice_Type: Receipt Invoice Type\n
    :type Receipt_Invoice_Type: bool\n
    :param SD_card_near_full: SD card near full\n
    :type SD_card_near_full: bool\n
    :param SD_card_full: SD card full\n
    :type SD_card_full: bool\n
    :param CU_fiscalized: CU fiscalized\n
    :type CU_fiscalized: bool\n
    :param CU_produced: CU produced\n
    :type CU_produced: bool\n
    :param Paired_with_TIMS: Paired with TIMS\n
    :type Paired_with_TIMS: bool\n
    :param Unsent_receipts: Unsent receipts\n
    :type Unsent_receipts: bool\n
    :param No_Sec_IC: No Sec.IC\n
    :type No_Sec_IC: bool\n
    :param No_certificates: No certificates\n
    :type No_certificates: bool\n
    :param Service_jumper: Service jumper\n
    :type Service_jumper: bool\n
    :param Missing_SD_card: Missing SD card\n
    :type Missing_SD_card: bool\n
    :param Wrong_SD_card: Wrong SD card\n
    :type Wrong_SD_card: bool\n
    """
    def __init__(self, Power_down_in_opened_fiscal_receipt, DateTime_not_set, DateTime_wrong, RAM_reset, Hardware_clock_error, Reports_registers_Overflow, Opened_Fiscal_Receipt, Receipt_Invoice_Type, SD_card_near_full, SD_card_full, CU_fiscalized, CU_produced, Paired_with_TIMS, Unsent_receipts, No_Sec_IC, No_certificates, Service_jumper, Missing_SD_card, Wrong_SD_card):
        self.Power_down_in_opened_fiscal_receipt = Power_down_in_opened_fiscal_receipt
        self.DateTime_not_set = DateTime_not_set
        self.DateTime_wrong = DateTime_wrong
        self.RAM_reset = RAM_reset
        self.Hardware_clock_error = Hardware_clock_error
        self.Reports_registers_Overflow = Reports_registers_Overflow
        self.Opened_Fiscal_Receipt = Opened_Fiscal_Receipt
        self.Receipt_Invoice_Type = Receipt_Invoice_Type
        self.SD_card_near_full = SD_card_near_full
        self.SD_card_full = SD_card_full
        self.CU_fiscalized = CU_fiscalized
        self.CU_produced = CU_produced
        self.Paired_with_TIMS = Paired_with_TIMS
        self.Unsent_receipts = Unsent_receipts
        self.No_Sec_IC = No_Sec_IC
        self.No_certificates = No_certificates
        self.Service_jumper = Service_jumper
        self.Missing_SD_card = Missing_SD_card
        self.Wrong_SD_card = Wrong_SD_card


class __TCP_PasswordRes__:
    """
    :param PassLength: Up to 3 symbols for the password length\n
    :type PassLength: float\n
    :param Password: (Password) Up to 100 symbols for the TCP password\n
    :type Password: str\n
    """
    def __init__(self, PassLength, Password):
        self.PassLength = PassLength
        self.Password = Password


class __VATratesRes__:
    """
    :param VATrateA: (VAT rate A) Up to 7 symbols for VATrates of VAT class A in format ##.##%\n
    :type VATrateA: float\n
    :param VATrateB: (VAT rate B) Up to 7 symbols for VATrates of VAT class B in format ##.##%\n
    :type VATrateB: float\n
    :param VATrateC: (VAT rate C) Up to 7 symbols for VATrates of VAT class C in format ##.##%\n
    :type VATrateC: float\n
    :param VATrateD: (VAT rate D) Up to 7 symbols for VATrates of VAT class D in format ##.##%\n
    :type VATrateD: float\n
    :param VATrateE: (VAT rate E) Up to 7 symbols for VATrates of VAT class E in format ##.##%\n
    :type VATrateE: float\n
    """
    def __init__(self, VATrateA, VATrateB, VATrateC, VATrateD, VATrateE):
        self.VATrateA = VATrateA
        self.VATrateB = VATrateB
        self.VATrateC = VATrateC
        self.VATrateD = VATrateD
        self.VATrateE = VATrateE


class __WiFi_NetworkNameRes__:
    """
    :param WiFiNameLength: Up to 3 symbols for the WiFi name length\n
    :type WiFiNameLength: float\n
    :param WiFiNetworkName: (Name) Up to 100 symbols for the device's WiFi network name\n
    :type WiFiNetworkName: str\n
    """
    def __init__(self, WiFiNameLength, WiFiNetworkName):
        self.WiFiNameLength = WiFiNameLength
        self.WiFiNetworkName = WiFiNetworkName


class __WiFi_PasswordRes__:
    """
    :param PassLength: Up to 3 symbols for the WiFi password length\n
    :type PassLength: float\n
    :param Password: Up to 100 symbols for the device's WiFi password\n
    :type Password: str\n
    """
    def __init__(self, PassLength, Password):
        self.PassLength = PassLength
        self.Password = Password


class Enums:
    """Enumerations"""

    class OptionTaxable(Enum):
        Exempted = u'1'
        Taxable = u'0'

    class OptionReceiptFormat(Enum):
        Brief = u'0'
        Detailed = u'1'

    class OptionIsReceiptOpened(Enum):
        No = u'0'
        Yes = u'1'

    class OptionClientReceipt(Enum):
        invoice_client_receipt = u'1'
        standard_receipt = u'0'

    class OptionPowerDownInReceipt(Enum):
        No = u'0'
        Yes = u'1'

    class OptionLAN(Enum):
        No = u'0'
        Yes = u'1'

    class OptionWiFi(Enum):
        No = u'0'
        Yes = u'1'

    class OptionGPRS(Enum):
        No = u'0'
        Yes = u'1'

    class OptionBT(Enum):
        No = u'0'
        Yes = u'1'

    class OptionAddressType(Enum):
        DNS_address = u'5'
        Gateway_address = u'4'
        IP_address = u'2'
        Subnet_Mask = u'3'

    class OptionDHCPEnabled(Enum):
        Disabled = u'0'
        Enabled = u'1'

    class OptionDeviceType(Enum):
        A_Type = u'1'
        B_Type = u'2'

    class OptionReadEJStorage(Enum):
        Reading_to_PC = u'J0'
        Reading_to_PC_for_JSON = u'JY'

    class OptionAuthenticationType(Enum):
        CHAP = u'2'
        NONE1 = u'0'
        PAP = u'1'
        PAP_or_CHAP = u'3'

    class OptionServerResponse(Enum):
        At_send_EOD = u'Z'
        At_send_receipt = u'R'

    class OptionTransactionType(Enum):
        Error_Code = u'c'
        Error_Message = u'm'
        Exception_Message = u'e'
        Status = u's'

    class OptionInvoiceCopy(Enum):
        Reading = u'J0'
        Storage_in_External_SD_card_memory = u'J4'
        Storage_in_External_USB_Flash_memory = u'J2'

    class OptionModule(Enum):
        GSM = u'0'
        LANWiFi = u'1'

    class OptionTCPAutoStart(Enum):
        No = u'0'
        Yes = u'1'

    class OptionUsedModule(Enum):
        LAN_module = u'1'
        WiFi_module = u'2'

    class OptionVATClass(Enum):
        VAT_Class_A = u'A'
        VAT_Class_B = u'B'
        VAT_Class_C = u'C'
        VAT_Class_D = u'D'
        VAT_Class_E = u'E'

    class OptionReportStorage(Enum):
        Storage_in_External_SD_card_memory = u'J4'
        Storage_in_External_SD_card_memory_for_JSON = u'JX'
        Storage_in_External_USB_Flash_memory = u'J2'
        Storage_in_External_USB_Flash_memory_for_JSON = u'Jx'

    class OptionDisplay(Enum):
        No = u'0'
        Yes = u'1'


