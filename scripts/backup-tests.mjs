import assert from 'node:assert/strict';
import test from 'node:test';

import { createInstance } from 'i18next';

import {
  CURRENT_BACKUP_VERSION,
  MAX_BACKUP_RECORDS,
} from '../convex/lib/backup/constants.ts';
import { createBackupV2 } from '../convex/lib/backup/export.ts';
import { migrateBackupToCurrent } from '../convex/lib/backup/migrations.ts';
import {
  restoreValidatedBackup,
  sortBackupRecordsForTest,
} from '../convex/lib/backup/restore.ts';
import {
  assertRestoreCapacity,
  BackupValidationError,
  parseAndValidateBackupJson,
  validateBackupV2,
} from '../convex/lib/backup/validation.ts';
import { translationResources } from '../src/i18n/resources.ts';

const now = 1_760_000_000_000;

function emptyBackup() {
  return {
    format: 'shukatsu-manager-backup',
    backupVersion: 2,
    exportedAt: now,
    counts: {
      companies: 0,
      applications: 0,
      selectionSteps: 0,
      selectionProgressHistory: 0,
      events: 0,
      interviewDetails: 0,
      interviewQuestions: 0,
      knowledgeItems: 0,
      researchItems: 0,
    },
    profile: {
      displayName: 'Backup User',
      locale: 'ja-JP',
      timezone: 'Asia/Tokyo',
      updatedAt: now - 10,
    },
    data: {
      companies: [],
      applications: [],
      selectionSteps: [],
      selectionProgressHistory: [],
      events: [],
      interviewDetails: [],
      interviewQuestions: [],
      knowledgeItems: [],
      researchItems: [],
    },
  };
}

function completeBackup() {
  const backup = emptyBackup();
  backup.data.companies.push({
    backupId: 'company-1', sourceCreationTime: 1, name: 'Example', industry: 'Tech', websiteUrl: 'https://example.com', updatedAt: 101,
  });
  backup.data.applications.push({
    backupId: 'application-1', sourceCreationTime: 2, companyRef: 'company-1', jobTitle: 'Engineer', preferenceLevel: 4, applicationUrl: 'https://example.com/jobs', updatedAt: 102,
  });
  backup.data.selectionSteps.push({
    backupId: 'step-1', sourceCreationTime: 3, applicationRef: 'application-1', name: 'First Interview', presetKey: 'first_interview', type: 'interview', order: 0, result: 'passed', completed: true, updatedAt: 103,
  });
  backup.data.selectionProgressHistory.push({
    backupId: 'history-1', sourceCreationTime: 4, selectionStepRef: 'step-1', type: 'passed', occurredAt: 104, createdAt: 104,
  });
  backup.data.events.push({
    backupId: 'event-1', sourceCreationTime: 5, selectionStepRef: 'step-1', datetime: 105, timingType: 'scheduled', hasExplicitTime: true, meetingUrl: 'https://meet.example.com/1', updatedAt: 105,
  });
  backup.data.interviewDetails.push({
    backupId: 'detail-1', sourceCreationTime: 6, selectionStepRef: 'step-1', interviewFormat: 'online', improvementPoints: 'Be concise', updatedAt: 106,
  });
  backup.data.interviewQuestions.push({
    backupId: 'question-1', sourceCreationTime: 7, interviewDetailRef: 'detail-1', question: 'Why us?', answer: 'Because...', evaluation: 'poor', updatedAt: 107,
  });
  backup.data.knowledgeItems.push({
    backupId: 'knowledge-1', sourceCreationTime: 8, title: 'Motivation', content: 'Reusable answer', category: 'qa', sourceInterviewQuestionRef: 'question-1', sourceCompanyRef: 'company-1', updatedAt: 108,
  });
  backup.data.researchItems.push({
    backupId: 'research-1', sourceCreationTime: 9, companyRef: 'company-1', applicationRef: 'application-1', category: 'business', title: 'Product', content: 'Research', sourceUrls: ['https://example.com/about'], isPinned: true, updatedAt: 109,
  });

  for (const name of Object.keys(backup.counts)) {
    backup.counts[name] = backup.data[name].length;
  }
  return backup;
}

function expectBackupError(code, callback) {
  assert.throws(callback, (error) => error instanceof BackupValidationError && error.code === code);
}

function emptyOwnedData(overrides = {}) {
  return {
    companies: [], applications: [], selectionSteps: [], selectionProgressHistory: [], events: [],
    interviewDetails: [], interviewQuestions: [], knowledgeItems: [], researchItems: [],
    interviewQuestionGroups: [], weaknessGroups: [], weaknessOccurrences: [],
    ...overrides,
  };
}

function createMemoryMutationContext(user, initial = {}) {
  let creationTime = 10_000;
  const tableNames = [
    'users', 'companies', 'applications', 'selectionSteps', 'selectionProgressHistory',
    'events', 'interviewDetails', 'interviewQuestions', 'knowledgeItems', 'researchItems',
    'interviewQuestionGroups', 'weaknessGroups', 'weaknessOccurrences',
  ];
  const tables = new Map(tableNames.map((name) => [name, new Map()]));
  tables.get('users').set(user._id, structuredClone(user));
  for (const [tableName, documents] of Object.entries(initial)) {
    for (const document of documents) tables.get(tableName).set(document._id, structuredClone(document));
  }

  const db = {
    delete: async (id) => {
      for (const table of tables.values()) {
        if (table.delete(id)) return;
      }
      throw new Error(`Missing document ${id}`);
    },
    insert: async (tableName, value) => {
      creationTime += 1;
      const id = `${tableName}-generated-${creationTime}`;
      tables.get(tableName).set(id, { _id: id, _creationTime: creationTime, ...structuredClone(value) });
      return id;
    },
    replace: async (id, value) => {
      for (const table of tables.values()) {
        const current = table.get(id);
        if (current) {
          table.set(id, { _id: id, _creationTime: current._creationTime, ...structuredClone(value) });
          return;
        }
      }
      throw new Error(`Missing document ${id}`);
    },
  };

  return {
    ctx: { db },
    get: (tableName) => [...tables.get(tableName).values()],
    getById: (tableName, id) => tables.get(tableName).get(id),
  };
}

test('Backup V2 is current and migration routing rejects unsupported versions', () => {
  assert.equal(CURRENT_BACKUP_VERSION, 2);
  assert.deepEqual(migrateBackupToCurrent(emptyBackup()), emptyBackup());
  expectBackupError('version', () => parseAndValidateBackupJson(JSON.stringify({ ...emptyBackup(), backupVersion: 1 })));
  expectBackupError('version', () => parseAndValidateBackupJson(JSON.stringify({ ...emptyBackup(), backupVersion: 3 })));
});

test('export explicitly maps every core collection and excludes ownership and derived fields', () => {
  const owned = 'user-current';
  const sample = {
    companies: [
      { _id: 'company-1', _creationTime: 1, userId: owned, name: 'Example', industry: 'Tech', websiteUrl: 'https://example.com', updatedAt: 101 },
      { _id: 'company-2', _creationTime: 1.5, userId: owned, name: 'Second', updatedAt: 101.5 },
    ],
    applications: [
      { _id: 'application-1', _creationTime: 2, companyId: 'company-1', jobTitle: 'Engineer', preferenceLevel: 4, updatedAt: 102 },
      { _id: 'application-2', _creationTime: 2.5, companyId: 'company-2', jobTitle: 'Designer', updatedAt: 102.5 },
    ],
    selectionSteps: [
      { _id: 'step-1', _creationTime: 3, applicationId: 'application-1', name: 'First Interview', presetKey: 'first_interview', type: 'interview', order: 0, result: 'passed', completed: true, updatedAt: 103 },
      { _id: 'step-2', _creationTime: 3.5, applicationId: 'application-2', name: 'ES', presetKey: 'es', type: 'es', order: 0, result: null, completed: false, updatedAt: 103.5 },
    ],
    selectionProgressHistory: [
      { _id: 'history-1', _creationTime: 4, userId: owned, selectionStepId: 'step-1', type: 'passed', occurredAt: 104, createdAt: 104 },
      { _id: 'history-2', _creationTime: 4.5, userId: owned, selectionStepId: 'step-2', type: 'completed', occurredAt: 104.5, invalidatedAt: 105, createdAt: 104.5 },
    ],
    events: [
      { _id: 'event-1', _creationTime: 5, userId: owned, selectionStepId: 'step-1', datetime: 105, timingType: 'scheduled', hasExplicitTime: true, updatedAt: 105 },
      { _id: 'event-2', _creationTime: 5.5, userId: owned, title: 'Independent event', datetime: 105.5, timingType: 'deadline', hasExplicitTime: false, updatedAt: 105.5 },
    ],
    interviewDetails: [{ _id: 'detail-1', _creationTime: 6, selectionStepId: 'step-1', interviewFormat: 'online', improvementPoints: 'Be concise', updatedAt: 106 }],
    interviewQuestions: [
      { _id: 'question-1', _creationTime: 7, interviewDetailId: 'detail-1', questionGroupId: 'derived-group', question: 'Why us?', answer: 'Because...', evaluation: 'poor', updatedAt: 107 },
      { _id: 'question-2', _creationTime: 7.5, interviewDetailId: 'detail-1', question: 'Your strength?', answer: 'Strength...', updatedAt: 107.5 },
    ],
    knowledgeItems: [
      { _id: 'knowledge-1', _creationTime: 8, userId: owned, title: 'Motivation', content: 'Reusable answer', category: 'qa', sourceInterviewQuestionId: 'question-1', sourceCompanyId: 'company-1', updatedAt: 108 },
      { _id: 'knowledge-2', _creationTime: 8.5, userId: owned, title: 'Material', category: 'material', updatedAt: 108.5 },
    ],
    researchItems: [
      { _id: 'research-1', _creationTime: 9, companyId: 'company-1', applicationId: 'application-1', category: 'business', title: 'Product', content: 'Research', sourceUrls: ['https://example.com/about'], isPinned: true, updatedAt: 109 },
      { _id: 'research-2', _creationTime: 9.5, companyId: 'company-2', category: 'culture', content: 'Culture', isPinned: false, updatedAt: 109.5 },
    ],
    interviewQuestionGroups: [{ _id: 'derived-question-group' }],
    weaknessGroups: [{ _id: 'derived-weakness-group' }],
    weaknessOccurrences: [{ _id: 'derived-occurrence' }],
  };
  const user = { _id: owned, _creationTime: 0, authUserId: 'clerk-secret', displayName: 'Backup User', locale: 'ja-JP', timezone: 'Asia/Tokyo', updatedAt: 99 };
  const backup = createBackupV2(user, sample, now);

  assert.deepEqual(backup.counts, {
    companies: 2, applications: 2, selectionSteps: 2, selectionProgressHistory: 2,
    events: 2, interviewDetails: 1, interviewQuestions: 2, knowledgeItems: 2, researchItems: 2,
  });
  assert.equal(backup.data.selectionSteps[0].presetKey, 'first_interview');
  assert.equal(backup.data.selectionProgressHistory[1].invalidatedAt, 105);
  assert.equal(backup.data.events[1].title, 'Independent event');
  assert.equal(backup.data.interviewQuestions[1].sourceCreationTime, 7.5);
  assert.deepEqual(validateBackupV2(backup), backup);
  const serialized = JSON.stringify(backup);
  for (const forbidden of ['authUserId', 'userId', 'questionGroupId', 'derived-group', 'derived-question-group', 'derived-weakness-group', 'derived-occurrence', 'clerk-secret']) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
});

test('valid backup parses with optional references omitted', () => {
  const backup = completeBackup();
  delete backup.data.events[0].selectionStepRef;
  backup.data.events[0].title = 'Independent event';
  delete backup.data.knowledgeItems[0].sourceInterviewQuestionRef;
  delete backup.data.knowledgeItems[0].sourceCompanyRef;
  delete backup.data.researchItems[0].applicationRef;
  assert.deepEqual(parseAndValidateBackupJson(JSON.stringify(backup)), backup);
});

test('validation rejects malformed envelopes, required fields, duplicates, counts, and broken references', () => {
  expectBackupError('parse', () => parseAndValidateBackupJson('{bad json'));
  expectBackupError('format', () => parseAndValidateBackupJson(JSON.stringify({ ...emptyBackup(), format: 'other' })));

  for (const [collection, field] of [['companies', 'name'], ['selectionSteps', 'type'], ['knowledgeItems', 'category']]) {
    const missing = completeBackup();
    delete missing.data[collection][0][field];
    expectBackupError('incomplete', () => validateBackupV2(missing));
  }

  const duplicate = completeBackup();
  duplicate.data.companies.push({ ...duplicate.data.companies[0] });
  duplicate.counts.companies += 1;
  expectBackupError('incomplete', () => validateBackupV2(duplicate));

  const countMismatch = completeBackup();
  countMismatch.counts.events = 99;
  expectBackupError('incomplete', () => validateBackupV2(countMismatch));

  const brokenCases = [
    ['applications', 'companyRef'], ['selectionSteps', 'applicationRef'],
    ['selectionProgressHistory', 'selectionStepRef'], ['events', 'selectionStepRef'],
    ['interviewDetails', 'selectionStepRef'], ['interviewQuestions', 'interviewDetailRef'],
    ['knowledgeItems', 'sourceCompanyRef'], ['knowledgeItems', 'sourceInterviewQuestionRef'],
    ['researchItems', 'companyRef'], ['researchItems', 'applicationRef'],
  ];
  for (const [collection, field] of brokenCases) {
    const broken = completeBackup();
    broken.data[collection][0][field] = 'missing-record';
    expectBackupError('relations', () => validateBackupV2(broken));
  }
});

test('business rules reject invalid steps, events, interview parents, URLs, and research scope', () => {
  const cases = [
    (backup) => { backup.data.selectionSteps[0].completed = false; },
    (backup) => { backup.data.selectionSteps[0].result = 'failed'; backup.data.selectionSteps[0].completed = false; },
    (backup) => { backup.data.selectionSteps[0].presetKey = 'es'; },
    (backup) => { backup.data.selectionSteps[0].order = 2; },
    (backup) => { backup.data.events[0].hasExplicitTime = false; },
    (backup) => { backup.data.events[0].title = 'Bound event cannot have title'; },
    (backup) => { backup.data.interviewDetails[0].selectionStepRef = 'step-1'; backup.data.selectionSteps[0].type = 'other'; delete backup.data.selectionSteps[0].presetKey; },
    (backup) => { backup.data.researchItems[0].sourceUrls = ['javascript:alert(1)']; },
    (backup) => { backup.data.researchItems[0].sourceUrls = ['https://example.com', 'https://example.com']; },
  ];
  for (const mutate of cases) {
    const backup = completeBackup();
    mutate(backup);
    expectBackupError('incomplete', () => validateBackupV2(backup));
  }

  const duplicateEvent = completeBackup();
  duplicateEvent.data.events.push({ ...duplicateEvent.data.events[0], backupId: 'event-2' });
  duplicateEvent.counts.events += 1;
  expectBackupError('incomplete', () => validateBackupV2(duplicateEvent));

  const duplicateDetail = completeBackup();
  duplicateDetail.data.interviewDetails.push({ ...duplicateDetail.data.interviewDetails[0], backupId: 'detail-2' });
  duplicateDetail.counts.interviewDetails += 1;
  expectBackupError('incomplete', () => validateBackupV2(duplicateDetail));

  const wrongScope = completeBackup();
  wrongScope.data.companies.push({ backupId: 'company-2', sourceCreationTime: 10, name: 'Other', updatedAt: 110 });
  wrongScope.counts.companies += 1;
  wrongScope.data.researchItems[0].companyRef = 'company-2';
  expectBackupError('relations', () => validateBackupV2(wrongScope));

  const duplicateCompany = completeBackup();
  duplicateCompany.data.companies.push({ backupId: 'company-2', sourceCreationTime: 10, name: ' example ', updatedAt: 110 });
  duplicateCompany.counts.companies += 1;
  expectBackupError('incomplete', () => validateBackupV2(duplicateCompany));

  const duplicateApplication = completeBackup();
  duplicateApplication.data.applications.push({ backupId: 'application-2', sourceCreationTime: 10, companyRef: 'company-1', jobTitle: ' engineer ', updatedAt: 110 });
  duplicateApplication.counts.applications += 1;
  expectBackupError('incomplete', () => validateBackupV2(duplicateApplication));
});

test('creation order sort is deterministic and keeps source order', () => {
  assert.deepEqual(
    sortBackupRecordsForTest([
      { backupId: 'z', sourceCreationTime: 3 },
      { backupId: 'b', sourceCreationTime: 1 },
      { backupId: 'a', sourceCreationTime: 1 },
    ]).map((item) => item.backupId),
    ['a', 'b', 'z'],
  );
});

test('empty-account restore remaps every ID, relation, owner, profile, and timestamp', async () => {
  const user = { _id: 'current-user', _creationTime: 1, authUserId: 'current-clerk', displayName: 'Before', locale: 'zh-CN', timezone: 'Asia/Shanghai', updatedAt: 1 };
  const memory = createMemoryMutationContext(user);
  const backup = completeBackup();
  backup.data.interviewQuestions.push({ backupId: 'question-2', sourceCreationTime: 6.5, interviewDetailRef: 'detail-1', question: 'Earlier question', updatedAt: 106.5 });
  backup.counts.interviewQuestions += 1;

  await restoreValidatedBackup(memory.ctx, user, emptyOwnedData(), backup);

  const restoredUser = memory.getById('users', user._id);
  assert.deepEqual(
    { id: restoredUser._id, authUserId: restoredUser.authUserId, displayName: restoredUser.displayName, locale: restoredUser.locale, timezone: restoredUser.timezone, updatedAt: restoredUser.updatedAt },
    { id: user._id, authUserId: 'current-clerk', displayName: 'Backup User', locale: 'ja-JP', timezone: 'Asia/Tokyo', updatedAt: now - 10 },
  );

  const [company] = memory.get('companies');
  const [application] = memory.get('applications');
  const [step] = memory.get('selectionSteps');
  const [event] = memory.get('events');
  const [detail] = memory.get('interviewDetails');
  const questions = memory.get('interviewQuestions');
  const [knowledge] = memory.get('knowledgeItems');
  const [research] = memory.get('researchItems');
  const [history] = memory.get('selectionProgressHistory');

  assert.equal(company.userId, user._id);
  assert.notEqual(company._id, 'company-1');
  assert.equal(application.companyId, company._id);
  assert.equal(step.applicationId, application._id);
  assert.equal(step.presetKey, 'first_interview');
  assert.equal(event.selectionStepId, step._id);
  assert.equal(detail.selectionStepId, step._id);
  assert.deepEqual(questions.map((question) => question.question), ['Earlier question', 'Why us?']);
  assert.equal(knowledge.sourceCompanyId, company._id);
  assert.equal(knowledge.sourceInterviewQuestionId, questions[1]._id);
  assert.equal(research.companyId, company._id);
  assert.equal(research.applicationId, application._id);
  assert.equal(history.selectionStepId, step._id);
  assert.equal(history.occurredAt, 104);
  assert.equal(history.createdAt, 104);
});

test('full replace removes old core and derived data, preserves other users, and is repeatable', async () => {
  const user = { _id: 'current-user', _creationTime: 1, authUserId: 'current-clerk', displayName: 'Before', updatedAt: 1 };
  const oldDocuments = {
    companies: [{ _id: 'old-company', _creationTime: 2, userId: user._id, name: 'Old', updatedAt: 2 }, { _id: 'other-company', _creationTime: 3, userId: 'other-user', name: 'Other user', updatedAt: 3 }],
    applications: [{ _id: 'old-application', _creationTime: 4, companyId: 'old-company', jobTitle: 'Old role', updatedAt: 4 }],
    selectionSteps: [{ _id: 'old-step', _creationTime: 5, applicationId: 'old-application', name: 'Old step', type: 'interview', order: 0, result: null, completed: false, updatedAt: 5 }],
    interviewDetails: [{ _id: 'old-detail', _creationTime: 6, selectionStepId: 'old-step', updatedAt: 6 }],
    interviewQuestionGroups: [{ _id: 'old-question-group', _creationTime: 7, userId: user._id, title: 'Derived', updatedAt: 7 }],
    weaknessGroups: [{ _id: 'old-weakness-group', _creationTime: 8, userId: user._id, title: 'Derived', updatedAt: 8 }],
    weaknessOccurrences: [{ _id: 'old-occurrence', _creationTime: 9, interviewDetailId: 'old-detail', weaknessGroupId: 'old-weakness-group', extractedWeakness: 'Derived' }],
  };
  const memory = createMemoryMutationContext(user, oldDocuments);
  const current = emptyOwnedData({
    companies: [oldDocuments.companies[0]], applications: oldDocuments.applications,
    selectionSteps: oldDocuments.selectionSteps, interviewDetails: oldDocuments.interviewDetails,
    interviewQuestionGroups: oldDocuments.interviewQuestionGroups,
    weaknessGroups: oldDocuments.weaknessGroups, weaknessOccurrences: oldDocuments.weaknessOccurrences,
  });
  const backup = completeBackup();

  await restoreValidatedBackup(memory.ctx, user, current, backup);
  const firstCompanyId = memory.get('companies').find((company) => company.userId === user._id)._id;
  assert.equal(memory.getById('companies', 'old-company'), undefined);
  assert.equal(memory.getById('companies', 'other-company').name, 'Other user');
  assert.equal(memory.get('interviewQuestionGroups').length, 0);
  assert.equal(memory.get('weaknessGroups').length, 0);
  assert.equal(memory.get('weaknessOccurrences').length, 0);

  const restoredCurrent = emptyOwnedData(Object.fromEntries(
    Object.keys(emptyOwnedData()).map((name) => [name, memory.get(name).filter((document) => document.userId !== 'other-user')]),
  ));
  await restoreValidatedBackup(memory.ctx, memory.getById('users', user._id), restoredCurrent, backup);
  const ownedCompanies = memory.get('companies').filter((company) => company.userId === user._id);
  assert.equal(ownedCompanies.length, 1);
  assert.notEqual(ownedCompanies[0]._id, firstCompanyId);
  assert.equal(memory.get('applications').length, 1);
  assert.equal(memory.get('knowledgeItems').length, 1);
  assert.equal(memory.get('selectionProgressHistory').length, 1);
  assert.equal(memory.getById('companies', 'other-company').name, 'Other user');
});

test('restoring an absent optional profile value clears the current value without replacing identity', async () => {
  const user = { _id: 'current-user', _creationTime: 1, authUserId: 'current-clerk', displayName: 'Before', locale: 'zh-CN', timezone: 'Asia/Shanghai', updatedAt: 1 };
  const memory = createMemoryMutationContext(user);
  const backup = emptyBackup();
  backup.profile = { updatedAt: 42 };
  await restoreValidatedBackup(memory.ctx, user, emptyOwnedData(), backup);
  assert.deepEqual(memory.getById('users', user._id), {
    _id: user._id, _creationTime: user._creationTime, authUserId: 'current-clerk', updatedAt: 42,
  });
});

test('capacity guards reject oversized record sets and combined restore estimates', () => {
  const oversized = emptyBackup();
  oversized.data.companies = Array.from({ length: MAX_BACKUP_RECORDS + 1 }, (_, index) => ({
    backupId: `company-${index}`, sourceCreationTime: index, name: `Company ${index}`, updatedAt: index,
  }));
  oversized.counts.companies = oversized.data.companies.length;
  expectBackupError('too_large', () => parseAndValidateBackupJson(JSON.stringify(oversized)));

  const backup = completeBackup();
  expectBackupError('too_large', () => assertRestoreCapacity({
    backup,
    backupJson: JSON.stringify(backup),
    currentEstimatedBytes: 8 * 1024 * 1024,
    currentRecordCount: 0,
  }));
});

test('backup UI copy exists in all three locales', async () => {
  for (const locale of ['zh-CN', 'ja-JP', 'en-US']) {
    const i18n = createInstance();
    await i18n.init({ resources: translationResources, lng: locale, fallbackLng: false, initAsync: false });
    for (const key of ['profile:backup.dataManagement', 'profile:backup.overwriteWarningTitle', 'profile:backup.errors.relations', 'profile:backup.restoreSuccess']) {
      assert.notEqual(i18n.t(key), key, `${locale} is missing ${key}`);
    }
  }
});
