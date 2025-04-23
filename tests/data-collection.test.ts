import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract environment
const mockInstitutionContract = {
  verifiedInstitutions: new Map(),
  
  isVerified(institution) {
    return this.verifiedInstitutions.has(institution);
  }
};

const mockProtocolContract = {
  protocols: new Map(),
  
  getProtocol(protocolId) {
    return this.protocols.get(protocolId) || null;
  }
};

const mockEnrollmentContract = {
  enrollments: new Map(),
  
  getEnrollment(protocolId, patientId) {
    const enrollmentKey = `${protocolId}-${patientId}`;
    return this.enrollments.get(enrollmentKey) || null;
  }
};

const mockDataCollectionContract = {
  admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  dataEntries: new Map(),
  dataIdCounter: 0,
  blockHeight: 100,
  institutionContract: mockInstitutionContract,
  protocolContract: mockProtocolContract,
  enrollmentContract: mockEnrollmentContract,
  
  isAdmin(caller) {
    return caller === this.admin;
  },
  
  addDataEntry(caller, protocolId, patientId, dataHash, dataType, metadata) {
    if (!this.institutionContract.isVerified(caller)) {
      return { type: 'err', value: 401 }; // ERR-NOT-VERIFIED
    }
    
    const protocol = this.protocolContract.getProtocol(protocolId);
    if (!protocol) {
      return { type: 'err', value: 402 }; // ERR-PROTOCOL-NOT-FOUND
    }
    
    if (protocol.institution !== caller) {
      return { type: 'err', value: 403 }; // ERR-UNAUTHORIZED
    }
    
    const enrollment = this.enrollmentContract.getEnrollment(protocolId, patientId);
    if (!enrollment) {
      return { type: 'err', value: 404 }; // ERR-ENROLLMENT-NOT-FOUND
    }
    
    const newId = this.dataIdCounter + 1;
    
    this.dataEntries.set(newId, {
      protocolId,
      patientId,
      institution: caller,
      timestamp: this.blockHeight,
      dataHash,
      dataType,
      metadata
    });
    
    this.dataIdCounter = newId;
    return { type: 'ok', value: newId };
  },
  
  getDataEntry(dataId) {
    return this.dataEntries.get(dataId) || null;
  },
  
  verifyDataIntegrity(dataId, dataHash) {
    const entry = this.dataEntries.get(dataId);
    if (!entry) {
      return { type: 'err', value: 405 }; // ERR-NOT-FOUND
    }
    
    return { type: 'ok', value: Buffer.compare(entry.dataHash, dataHash) === 0 };
  },
  
  transferAdmin(caller, newAdmin) {
    if (!this.isAdmin(caller)) {
      return { type: 'err', value: 400 }; // ERR-NOT-ADMIN
    }
    
    this.admin = newAdmin;
    return { type: 'ok', value: true };
  }
};

describe('Data Collection Contract', () => {
  beforeEach(() => {
    // Reset the contract state before each test
    mockDataCollectionContract.admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockDataCollectionContract.dataEntries = new Map();
    mockDataCollectionContract.dataIdCounter = 0;
    mockDataCollectionContract.blockHeight = 100;
    mockInstitutionContract.verifiedInstitutions = new Map();
    mockProtocolContract.protocols = new Map();
    mockEnrollmentContract.enrollments = new Map();
  });
  
  it('should add a data entry when called by the protocol owner', () => {
    const institution = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const protocolId = 1;
    const patientId = 'PATIENT123';
    const dataHash = Buffer.from('data-hash-123');
    const dataType = 'blood-test';
    const metadata = 'Blood test results from visit 1';
    
    mockInstitutionContract.verifiedInstitutions.set(institution, true);
    mockProtocolContract.protocols.set(protocolId, {
      institution: institution,
      title: 'Test Protocol'
    });
    mockEnrollmentContract.enrollments.set(`${protocolId}-${patientId}`, {
      institution: institution,
      status: 'active'
    });
    
    const result = mockDataCollectionContract.addDataEntry(
        institution,
        protocolId,
        patientId,
        dataHash,
        dataType,
        metadata
    );
    
    expect(result.type).toBe('ok');
    expect(result.value).toBe(1);
    
    const dataEntry = mockDataCollectionContract.getDataEntry(1);
    expect(dataEntry).not.toBeNull();
    expect(dataEntry.protocolId).toBe(protocolId);
    expect(dataEntry.patientId).toBe(patientId);
    expect(dataEntry.dataType).toBe(dataType);
  });
  
  it('should fail to add a data entry when called by a non-verified institution', () => {
    const institution = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const protocolId = 1;
    const patientId = 'PATIENT123';
    const dataHash = Buffer.from('data-hash-123');
    const dataType = 'blood-test';
    const metadata = 'Blood test results from visit 1';
    
    // Not adding to verified institutions
    mockProtocolContract.protocols.set(protocolId, {
      institution: institution,
      title: 'Test Protocol'
    });
    mockEnrollmentContract.enrollments.set(`${protocolId}-${patientId}`, {
      institution: institution,
      status: 'active'
    });
    
    const result = mockDataCollectionContract.addDataEntry(
        institution,
        protocolId,
        patientId,
        dataHash,
        dataType,
        metadata
    );
    
    expect(result.type).toBe('err');
    expect(result.value).toBe(401); // ERR-NOT-VERIFIED
  });
  
  it('should fail to add a data entry for a non-existent protocol', () => {
    const institution = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const protocolId = 1;
    const patientId = 'PATIENT123';
    const dataHash = Buffer.from('data-hash-123');
    const dataType = 'blood-test';
    const metadata = 'Blood test results from visit 1';
    
    mockInstitutionContract.verifiedInstitutions.set(institution, true);
    // Not adding protocol to the map
    mockEnrollmentContract.enrollments.set(`${protocolId}-${patientId}`, {
      institution: institution,
      status: 'active'
    });
    
    const result = mockDataCollectionContract.addDataEntry(
        institution,
        protocolId,
        patientId,
        dataHash,
        dataType,
        metadata
    );
    
    expect(result.type).toBe('err');
    expect(result.value).toBe(402); // ERR-PROTOCOL-NOT-FOUND
  });
  
  it('should fail to add a data entry for a non-enrolled patient', () => {
    const institution = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const protocolId = 1;
    const patientId = 'PATIENT123';
    const dataHash = Buffer.from('data-hash-123');
    const dataType = 'blood-test';
    const metadata = 'Blood test results from visit 1';
    
    mockInstitutionContract.verifiedInstitutions.set(institution, true);
    mockProtocolContract.protocols.set(protocolId, {
      institution: institution,
      title: 'Test Protocol'
    });
    // Not adding enrollment to the map
    
    const result = mockDataCollectionContract.addDataEntry(
        institution,
        protocolId,
        patientId,
        dataHash,
        dataType,
        metadata
    );
    
    expect(result.type).toBe('err');
    expect(result.value).toBe(404); // ERR-ENROLLMENT-NOT-FOUND
  });
  
  it('should verify data integrity correctly', () => {
    const institution = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const protocolId = 1;
    const patientId = 'PATIENT123';
    const dataHash = Buffer.from('data-hash-123');
    const dataType = 'blood-test';
    const metadata = 'Blood test results from visit 1';
    
    mockInstitutionContract.verifiedInstitutions.set(institution, true);
    mockProtocolContract.protocols.set(protocolId, {
      institution: institution,
      title: 'Test Protocol'
    });
    mockEnrollmentContract.enrollments.set(`${protocolId}-${patientId}`, {
      institution: institution,
      status: 'active'
    });
    
    // Add a data entry
    const addResult = mockDataCollectionContract.addDataEntry(
        institution,
        protocolId,
        patientId,
        dataHash,
        dataType,
        metadata
    );
    
    const dataId = addResult.value;
    
    // Verify with the correct hash
    const correctVerifyResult = mockDataCollectionContract.verifyDataIntegrity(dataId, dataHash);
    expect(correctVerifyResult.type).toBe('ok');
    expect(correctVerifyResult.value).toBe(true);
    
    // Verify with an incorrect hash
    const incorrectHash = Buffer.from('wrong-hash');
    const incorrectVerifyResult = mockDataCollectionContract.verifyDataIntegrity(dataId, incorrectHash);
    expect(incorrectVerifyResult.type).toBe('ok');
    expect(incorrectVerifyResult.value).toBe(false);
  });
});
