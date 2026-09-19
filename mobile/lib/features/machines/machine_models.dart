class MachineType {
  MachineType({required this.id, required this.name, required this.spindles, this.rpmMin, this.rpmMax, this.minRuntime, this.maxRuntime, this.description, this.definitionCount = 0});

  final int id;
  final String name;
  final int spindles;
  final int? rpmMin;
  final int? rpmMax;
  final double? minRuntime;
  final double? maxRuntime;
  final String? description;
  final int definitionCount;

  factory MachineType.fromJson(Map<String, dynamic> j) => MachineType(
        id: j['id'] as int,
        name: j['type_name'] as String,
        spindles: (j['total_spindles'] as num).toInt(),
        rpmMin: (j['rpm_min'] as num?)?.toInt(),
        rpmMax: (j['rpm_max'] as num?)?.toInt(),
        minRuntime: (j['min_runtime_hours'] as num?)?.toDouble(),
        maxRuntime: (j['max_runtime_hours'] as num?)?.toDouble(),
        description: j['description'] as String?,
        definitionCount: (j['machine_definitions_count'] as num?)?.toInt() ?? 0,
      );
}

class MachineDefinition {
  MachineDefinition({required this.id, required this.number, required this.typeId, this.typeName, required this.active, this.notes});

  final int id;
  final String number;
  final int typeId;
  final String? typeName;
  final bool active;
  final String? notes;

  factory MachineDefinition.fromJson(Map<String, dynamic> j) => MachineDefinition(
        id: j['id'] as int,
        number: j['machine_number'] as String,
        typeId: (j['machine_type_id'] as num).toInt(),
        typeName: (j['machine_type'] as Map?)?['type_name'] as String?,
        active: j['is_active'] == true || j['is_active'] == 1,
        notes: j['notes'] as String?,
      );
}
