import 'dart:async';

import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';

/// Voice input screen for the AI assistant.
///
/// Records a message with a live timer, simulates on-device transcription
/// (a real implementation can plug in the platform speech recognizer) and
/// pops back with the recognised text so the chat screen can send it.
class VoiceInputScreen extends StatefulWidget {
  const VoiceInputScreen({super.key});

  @override
  State<VoiceInputScreen> createState() => _VoiceInputScreenState();
}

class _VoiceInputScreenState extends State<VoiceInputScreen>
    with SingleTickerProviderStateMixin {
  final _controller = TextEditingController();
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
    lowerBound: 0.85,
    upperBound: 1.0,
    repeat: true,
  );
  Timer? _timer;
  Duration _elapsed = Duration.zero;
  bool _recording = false;
  bool _transcribing = false;

  @override
  void dispose() {
    _timer?.cancel();
    _pulse.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _start() {
    setState(() {
      _recording = true;
      _transcribing = false;
      _elapsed = Duration.zero;
    });
    _pulse.repeat();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _elapsed += const Duration(seconds: 1));
    });
  }

  Future<void> _stop() async {
    _timer?.cancel();
    _pulse.stop();
    if (!mounted) return;
    setState(() {
      _recording = false;
      _transcribing = true;
    });
    // Simulated on-device transcription delay.
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;
    setState(() {
      _transcribing = false;
      if (_controller.text.isEmpty) {
        _controller.text = 'Recorded message for the ASHA assistant';
      }
    });
  }

  void _send() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    Navigator.of(context).pop(text);
  }

  String get _timeLabel {
    final m = _elapsed.inMinutes.toString().padLeft(2, '0');
    final s = (_elapsed.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Voice Input',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Speak clearly. Transcript is editable before sending.')),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          child: Column(
            children: [
              const SizedBox(height: 32),
              Text(
                _recording
                    ? 'Listening…'
                    : (_transcribing ? 'Transcribing…' : 'Tap to start'),
                style: ASHATypography.headlineMD,
              ),
              const SizedBox(height: 8),
              Text(
                _recording ? _timeLabel : '',
                style: ASHATypography.bodyLG
                    .copyWith(color: ASHAColors.onSurfaceVariant),
              ),
              const SizedBox(height: 40),
              GestureDetector(
                onTap: _recording ? _stop : _start,
                child: ScaleTransition(
                  scale: _pulse,
                  child: Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      color: _recording
                          ? ASHAColors.errorContainer
                          : ASHAColors.primaryContainer,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: _recording
                            ? ASHAColors.error
                            : ASHAColors.primary,
                        width: 3,
                      ),
                    ),
                    child: Icon(
                      _recording ? Icons.stop : Icons.mic,
                      size: 40,
                      color: _recording
                          ? ASHAColors.onErrorContainer
                          : ASHAColors.primary,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 32),
              ASHATextField(
                label: 'Transcript',
                hint: 'Edit the recognised text…',
                controller: _controller,
                maxLines: 4,
              ),
              const Spacer(),
              ASHAButton(
                label: 'Send to Assistant',
                icon: Icons.auto_awesome,
                height: 48,
                onPressed: _transcribing ? null : _send,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
